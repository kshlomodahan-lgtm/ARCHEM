import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { DialogModule } from '@progress/kendo-angular-dialog';

interface QueueItem {
  QueueID: number;
  ItemLinkID: number;
  SupplierID: number;
  SupplierSKU: string;
  CustomerID: number;
  CustomerSKU: string;
  CustomerSKUDesc: string;
  SupplierName: string;
  CustomerName: string;
  AIStatus: string;
  Decision: string;
  CreatedAt: string;
}

interface AISuggestion {
  itemId: number;
  itemCode: string;
  itemName: string;
  supplierSku: string;
  score: number;
  reason: string;
}

interface Template {
  AttributeTemplateID: number;
  TemplateName: string;
  IsComposite: boolean;
  IsMandatory: boolean;
  fields: TemplateField[];
}

interface TemplateField {
  AttributeFieldID: number;
  FieldName: string;
  DataType: string;
  IsRequired: boolean;
  DisplayOrder: number;
  options: { OptionID: number; OptionValue: string }[];
}

interface ItemSearchResult {
  ItemID: number;
  ItemCode: string;
  NameHE: string;
  NameEN: string;
  SupplierSKU: string;
  SupplierName: string;
}

@Component({
  selector: 'app-cataloger',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, MatIconModule, DialogModule],
  templateUrl: './cataloger.component.html',
  styleUrl: './cataloger.component.scss',
})
export class CatalogerComponent implements OnInit {
  private fb = new FormBuilder();

  // Queue
  queueItems     = signal<QueueItem[]>([]);
  selectedItem   = signal<QueueItem | null>(null);
  queueCounts    = signal<any>({ PENDING: 0, DONE: 0 });
  activeFilter   = signal<'PENDING' | 'DONE'>('PENDING');
  loadingQueue   = signal(true);

  // AI
  aiLoading      = signal(false);
  aiSuggestions  = signal<AISuggestion[]>([]);
  aiError        = signal('');

  // Item search (for LINK decision)
  itemSearchQ    = '';
  itemSearchRes  = signal<ItemSearchResult[]>([]);
  searchingItems = signal(false);
  selectedExistingItem = signal<ItemSearchResult | null>(null);
  showLinkPanel  = signal(false);

  // Create form
  showCreateForm = signal(false);
  createForm = this.fb.group({
    nameHe:   ['', Validators.required],
    nameEn:   [''],
    itemCode: [''],
  });

  // Attributes
  availableTemplates = signal<Template[]>([]);
  linkedAttrs        = signal<any[]>([]);
  attrValues: Record<number, Record<number, any>> = {};
  addingTemplateId: number | null = null;
  saving = signal(false);

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadQueue();
    this.loadCounts();
    this.loadTemplates();
  }

  loadCounts() {
    this.http.get<any>('/api/catalog/queue/counts').subscribe({
      next: r => this.queueCounts.set(r.data),
    });
  }

  loadQueue() {
    this.loadingQueue.set(true);
    this.http.get<any>(`/api/catalog/queue?status=${this.activeFilter()}`).subscribe({
      next: r => { this.queueItems.set(r.data); this.loadingQueue.set(false); },
      error: () => this.loadingQueue.set(false),
    });
  }

  loadTemplates() {
    this.http.get<any>('/api/attributes/templates').subscribe({
      next: r => this.availableTemplates.set(r.data.filter((t: any) => t.IsActive)),
    });
  }

  setFilter(f: 'PENDING' | 'DONE') {
    this.activeFilter.set(f);
    this.loadQueue();
  }

  selectItem(item: QueueItem) {
    this.selectedItem.set(item);
    this.aiSuggestions.set([]);
    this.aiError.set('');
    this.showLinkPanel.set(false);
    this.showCreateForm.set(false);
    this.selectedExistingItem.set(null);
    this.itemSearchQ = '';
    this.itemSearchRes.set([]);
    this.linkedAttrs.set([]);
    this.attrValues = {};
    this.loadLinkedAttrs(item.ItemLinkID);
    if (item.AIStatus === 'DONE') {
      this.loadExistingSuggestions(item.QueueID);
    }
  }

  loadExistingSuggestions(queueId: number) {
    this.http.get<any>(`/api/catalog/queue/${queueId}`).subscribe({
      next: r => {
        const s = r.data.AISuggestions;
        if (Array.isArray(s)) this.aiSuggestions.set(s);
      }
    });
  }

  runAI() {
    const item = this.selectedItem();
    if (!item) return;
    this.aiLoading.set(true);
    this.aiError.set('');
    this.aiSuggestions.set([]);
    this.http.post<any>('/api/catalog/ai-suggest', {
      queueId: item.QueueID,
      itemLinkId: item.ItemLinkID,
      supplierSku: item.SupplierSKU,
      customerSkuDesc: item.CustomerSKUDesc,
    }).subscribe({
      next: r => {
        this.aiSuggestions.set(r.data.suggestions || []);
        this.aiLoading.set(false);
      },
      error: () => { this.aiError.set('שגיאה בחיפוש AI'); this.aiLoading.set(false); }
    });
  }

  scoreClass(score: number): string {
    if (score >= 0.8) return 'score-high';
    if (score >= 0.5) return 'score-mid';
    return 'score-low';
  }

  scoreLabel(score: number): string {
    return Math.round(score * 100) + '%';
  }

  // ── LINK DECISION ──
  openLinkPanel(suggestion?: AISuggestion) {
    this.showLinkPanel.set(true);
    this.showCreateForm.set(false);
    if (suggestion) {
      this.selectedExistingItem.set({
        ItemID: suggestion.itemId, ItemCode: suggestion.itemCode,
        NameHE: suggestion.itemName, NameEN: '', SupplierSKU: suggestion.supplierSku, SupplierName: ''
      });
      this.itemSearchQ = suggestion.itemName;
      this.itemSearchRes.set([]);
    }
  }

  searchItems() {
    const q = this.itemSearchQ;
    if (!q || q.length < 2) return;
    this.searchingItems.set(true);
    this.http.get<any>(`/api/catalog/items-search?q=${encodeURIComponent(q)}`).subscribe({
      next: r => { this.itemSearchRes.set(r.data); this.searchingItems.set(false); },
      error: () => this.searchingItems.set(false),
    });
  }

  selectExistingItem(item: ItemSearchResult) {
    this.selectedExistingItem.set(item);
    this.itemSearchRes.set([]);
  }

  confirmLink() {
    const item = this.selectedItem();
    const existing = this.selectedExistingItem();
    if (!item || !existing) return;
    this.saving.set(true);
    this.http.post<any>('/api/catalog/decide/link', {
      queueId: item.QueueID,
      itemLinkId: item.ItemLinkID,
      itemId: existing.ItemID,
    }).subscribe({
      next: () => { this.saving.set(false); this.afterDecision(); },
      error: e => { this.saving.set(false); alert(e.error?.message || 'שגיאה'); }
    });
  }

  // ── CREATE DECISION ──
  openCreateForm() {
    this.showCreateForm.set(true);
    this.showLinkPanel.set(false);
    this.createForm.reset({ nameHe: '', nameEn: '', itemCode: '' });
  }

  confirmCreate() {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    const item = this.selectedItem();
    if (!item) return;
    this.saving.set(true);
    const v = this.createForm.value;
    this.http.post<any>('/api/catalog/decide/create', {
      queueId: item.QueueID,
      itemLinkId: item.ItemLinkID,
      nameHe: v.nameHe, nameEn: v.nameEn, itemCode: v.itemCode,
    }).subscribe({
      next: () => { this.saving.set(false); this.afterDecision(); },
      error: e => { this.saving.set(false); alert(e.error?.message || 'שגיאה'); }
    });
  }

  skip() {
    const item = this.selectedItem();
    if (!item || !confirm('לדלג על פריט זה לעת עתה?')) return;
    this.http.post<any>('/api/catalog/decide/skip', { queueId: item.QueueID }).subscribe({
      next: () => this.afterDecision(),
    });
  }

  afterDecision() {
    this.selectedItem.set(null);
    this.loadQueue();
    this.loadCounts();
  }

  // ── ATTRIBUTES ──
  loadLinkedAttrs(itemLinkId: number) {
    this.http.get<any>(`/api/attributes/item-link/${itemLinkId}`).subscribe({
      next: r => {
        this.linkedAttrs.set(r.data);
        // init attrValues
        for (const tpl of r.data) {
          this.attrValues[tpl.itemLinkAttrId] = {};
          for (const f of tpl.fields) {
            this.attrValues[tpl.itemLinkAttrId][f.fieldId] = this.getFieldValue(f);
          }
        }
      }
    });
  }

  getFieldValue(f: any): any {
    if (f.dataType === 'BOOL')   return f.boolValue;
    if (f.dataType === 'NUMBER') return f.numberValue;
    if (f.dataType === 'DATE')   return f.dateValue;
    if (f.dataType === 'LIST' || f.dataType === 'MULTILIST') return f.optionId;
    return f.textValue;
  }

  getTemplate(templateId: number): Template | undefined {
    return this.availableTemplates().find(t => t.AttributeTemplateID === templateId);
  }

  addAttributeTemplate() {
    if (!this.addingTemplateId) return;
    const item = this.selectedItem();
    if (!item) return;
    const tpl = this.getTemplate(this.addingTemplateId);
    if (!tpl) return;

    this.http.get<any>(`/api/attributes/templates/${this.addingTemplateId}`).subscribe({
      next: r => {
        const values = (r.data.fields || []).map((f: TemplateField) => ({
          attributeFieldId: f.AttributeFieldID,
          textValue: null, numberValue: null, boolValue: null, dateValue: null, optionId: null
        }));
        this.http.post<any>('/api/attributes/item-link', {
          itemLinkId: item.ItemLinkID,
          attributeTemplateId: this.addingTemplateId,
          values,
        }).subscribe({
          next: () => {
            this.addingTemplateId = null;
            this.loadLinkedAttrs(item.ItemLinkID);
          }
        });
      }
    });
  }

  saveAttrValues(ilaId: number) {
    const vals = this.attrValues[ilaId];
    if (!vals) return;
    const values = Object.entries(vals).map(([fieldId, val]) => {
      const tpl = this.linkedAttrs().find(t => t.itemLinkAttrId === ilaId);
      const field = tpl?.fields.find((f: any) => f.fieldId === +fieldId);
      const dt = field?.dataType || 'TEXT';
      return {
        attributeFieldId: +fieldId,
        textValue:   dt === 'TEXT'   ? val : null,
        numberValue: dt === 'NUMBER' ? val : null,
        boolValue:   dt === 'BOOL'   ? (val === true || val === 'true' || val === 1 ? 1 : 0) : null,
        dateValue:   dt === 'DATE'   ? val : null,
        optionId:    (dt === 'LIST' || dt === 'MULTILIST') ? val : null,
      };
    });
    this.http.put<any>(`/api/attributes/item-link/${ilaId}/values`, { values }).subscribe({
      next: () => alert('מאפיינים נשמרו'),
    });
  }

  removeAttr(ilaId: number) {
    if (!confirm('להסיר מאפיין זה?')) return;
    const item = this.selectedItem();
    this.http.delete<any>(`/api/attributes/item-link/${ilaId}`).subscribe({
      next: () => item && this.loadLinkedAttrs(item.ItemLinkID),
    });
  }

  unusedTemplates(): Template[] {
    const usedIds = this.linkedAttrs().map((a: any) => a.templateId);
    return this.availableTemplates().filter(t => !usedIds.includes(t.AttributeTemplateID));
  }
}
