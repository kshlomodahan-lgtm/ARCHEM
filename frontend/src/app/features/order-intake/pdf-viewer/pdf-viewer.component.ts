import {
  Component, Input, Output, EventEmitter, OnChanges, SimpleChanges,
  ElementRef, ViewChild, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { getDocument, GlobalWorkerOptions, Util } from 'pdfjs-dist';
import type { PDFDocumentProxy, PageViewport } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

const ZOOM_STEP = 1.25;
const ZOOM_MIN  = 0.25;
const ZOOM_MAX  = 4.0;

@Component({
  selector:    'app-pdf-viewer',
  standalone:  true,
  imports:     [CommonModule],
  templateUrl: './pdf-viewer.component.html',
  styleUrl:    './pdf-viewer.component.scss',
})
export class PdfViewerComponent implements OnChanges, OnDestroy {
  @Input() src         = '';
  @Input() searchTerm  = '';
  @Output() debugEvent = new EventEmitter<string>();

  @ViewChild('pagesContainer') containerEl!: ElementRef<HTMLDivElement>;

  loading   = false;
  loadError = '';
  debugInfo = '';

  userZoom = 1.0;
  get zoomPct()    { return Math.round(this.userZoom * 100); }
  get canZoomIn()  { return this.userZoom < ZOOM_MAX; }
  get canZoomOut() { return this.userZoom > ZOOM_MIN; }

  private pdfDoc:     PDFDocumentProxy | null = null;
  private hlCanvases: HTMLCanvasElement[]     = [];
  private viewports:  PageViewport[]          = [];
  private fitScale  = 1.5;
  private scale     = 1.5;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['src']) {
      if (this.src) await this._load(this.src);
      else           this._clear();
    } else if (changes['searchTerm']) {
      await this._highlight(this.searchTerm);
    }
  }

  ngOnDestroy() { this.pdfDoc?.cleanup(); }

  // ── Zoom controls ────────────────────────────────────────────────────────────

  async zoomIn() {
    if (!this.canZoomIn) return;
    this.userZoom = Math.min(ZOOM_MAX, this.userZoom * ZOOM_STEP);
    await this._rerender();
  }

  async zoomOut() {
    if (!this.canZoomOut) return;
    this.userZoom = Math.max(ZOOM_MIN, this.userZoom / ZOOM_STEP);
    await this._rerender();
  }

  async resetZoom() {
    this.userZoom = 1.0;
    await this._rerender();
  }

  // ── Private: load / render ───────────────────────────────────────────────────

  private _clear() {
    this.pdfDoc?.cleanup();
    this.pdfDoc     = null;
    this.hlCanvases = [];
    this.viewports  = [];
    this.loadError  = '';
    this.debugInfo  = '';
    if (this.containerEl) this.containerEl.nativeElement.innerHTML = '';
  }

  private async _load(url: string) {
    this._clear();
    this.loading = true;
    try {
      this.pdfDoc = await getDocument({ url }).promise;
      await this._renderAll();
      if (this.searchTerm) await this._highlight(this.searchTerm);
    } catch (e: any) {
      this.loadError = 'שגיאה בטעינת PDF: ' + (e?.message || '');
    }
    this.loading = false;
  }

  /** Measures pane width reliably — waits for layout if needed. */
  private async _getPaneWidth(): Promise<number> {
    const paneEl = this.containerEl?.nativeElement?.parentElement;
    if (!paneEl) return Math.round(window.innerWidth * 0.44);

    // Wait up to ~200ms for the browser to complete layout
    for (let i = 0; i < 12; i++) {
      const w = paneEl.clientWidth;
      if (w > 50) return w;
      await new Promise<void>(r => requestAnimationFrame(() => r()));
    }
    // Fallback: estimate PDF pane as ~44% of screen
    return Math.max(600, Math.round(window.innerWidth * 0.44));
  }

  /** Calculate fitScale from real pane width, then render all pages. */
  private async _renderAll() {
    const doc   = this.pdfDoc!;
    const paneW = await this._getPaneWidth();

    const p1  = await doc.getPage(1);
    const vp1 = p1.getViewport({ scale: 1 });

    // Fit to pane width; never go below 1.2 so text is always readable
    this.fitScale = Math.max(1.2, (paneW - 24) / vp1.width);
    this.scale    = this.fitScale * this.userZoom;

    await this._doRenderPages();
  }

  /** Re-render at current scale after zoom, then re-highlight. */
  private async _rerender() {
    if (!this.pdfDoc) return;
    this.scale = this.fitScale * this.userZoom;
    await this._doRenderPages();
    if (this.searchTerm) await this._highlight(this.searchTerm);
  }

  /** Clear container and render every page at this.scale. */
  private async _doRenderPages() {
    const container = this.containerEl.nativeElement;
    const doc       = this.pdfDoc!;

    container.innerHTML = '';
    this.hlCanvases     = [];
    this.viewports      = [];

    for (let num = 1; num <= doc.numPages; num++) {
      const page     = await doc.getPage(num);
      const viewport = page.getViewport({ scale: this.scale });
      this.viewports.push(viewport);

      const wrap = document.createElement('div');
      wrap.style.cssText = `position:relative;display:block;width:${viewport.width}px;height:${viewport.height}px;box-shadow:0 4px 16px rgba(0,0,0,.5);flex-shrink:0;`;

      const cv        = document.createElement('canvas');
      cv.width        = viewport.width;
      cv.height       = viewport.height;
      cv.style.display = 'block';
      wrap.appendChild(cv);

      const hl = document.createElement('canvas');
      hl.width        = viewport.width;
      hl.height       = viewport.height;
      hl.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
      wrap.appendChild(hl);
      this.hlCanvases.push(hl);

      container.appendChild(wrap);
      await page.render({ canvas: cv, canvasContext: cv.getContext('2d')!, viewport }).promise;
    }
  }

  // ── Private: highlighting ────────────────────────────────────────────────────

  /** Normalise a string: lowercase, strip spaces/punctuation. */
  private _norm(t: string) { return t.toLowerCase().replace(/[\s\-\.\/\\,;:'"()\[\]]/g, ''); }

  /**
   * Decide whether a text item matches the search term.
   *
   * Rules (AND of guard + OR of match strategies):
   *  Guard:  item must be ≥ 4 normalised chars
   *  S1:     item is a meaningful PART of the full term  (item len ≥ 5 AND item contained in normTerm)
   *  S2:     item CONTAINS the full term
   *  S3:     item exactly equals one LONG word (≥ 5 chars) from the term
   */
  private _matches(itemStr: string, normTerm: string, longWords: string[]): boolean {
    const sn = this._norm(itemStr);
    if (sn.length < 4) return false;

    // S1 – item is a significant, specific substring of the search term
    if (sn.length >= 5 && normTerm.includes(sn)) return true;

    // S2 – item contains the full search term
    if (normTerm.length >= 4 && sn.includes(normTerm)) return true;

    // S3 – exact-word match for words ≥ 5 chars
    return longWords.some(w => sn === w || sn.includes(w) || w.includes(sn));
  }

  private async _highlight(term: string) {
    this._clearHighlights();
    if (!this.pdfDoc) return;

    if (!term.trim()) { this.debugInfo = ''; return; }

    const normTerm  = this._norm(term);
    const longWords = term.toLowerCase()
      .split(/\s+/)
      .map(w => this._norm(w))
      .filter(w => w.length >= 5);

    let totalItems = 0, matchCount = 0, scrolledToFirst = false;

    for (let i = 0; i < this.pdfDoc.numPages; i++) {
      const hl       = this.hlCanvases[i];
      const viewport = this.viewports[i];
      if (!hl || !viewport) continue;

      const page   = await this.pdfDoc.getPage(i + 1);
      const tc     = await page.getTextContent();
      const ctx    = hl.getContext('2d')!;
      let pageHit  = false;

      totalItems += tc.items.length;

      for (const rawItem of tc.items) {
        const item = rawItem as any;
        if (!item.str?.trim()) continue;

        if (!this._matches(item.str, normTerm, longWords)) continue;

        const tx = Util.transform(viewport.transform, item.transform);
        const bw = Math.abs(item.width) * this.scale;
        const bh = Math.abs(tx[3]);
        const bx = tx[4];
        const by = tx[5] - bh;
        if (bw < 2 || bh < 2) continue;

        ctx.fillStyle   = 'rgba(255, 210, 0, 0.55)';
        ctx.strokeStyle = 'rgba(180, 120, 0, 0.90)';
        ctx.lineWidth   = 1.5;
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);
        matchCount++;
        pageHit = true;
      }

      if (pageHit && !scrolledToFirst) {
        scrolledToFirst = true;
        const pageEl = this.containerEl.nativeElement.children[i] as HTMLElement;
        setTimeout(() => pageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      }
    }

    if (totalItems === 0) {
      this.debugInfo = 'PDF ללא שכבת טקסט — הדגשה לא זמינה';
    } else if (matchCount === 0) {
      this.debugInfo = `לא נמצאה התאמה ל"${term.slice(0, 20)}"`;
    } else {
      this.debugInfo = '';
    }
    this.debugEvent.emit(this.debugInfo);
  }

  private _clearHighlights() {
    for (const c of this.hlCanvases) {
      c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    }
  }
}
