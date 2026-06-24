import { Component, Input, Output, EventEmitter, signal, computed, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

export interface PickerItem { id: number; name: string; extra?: string; badge?: string; }

@Component({
  selector: 'app-list-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
<!-- Backdrop -->
<div class="pk-backdrop" (click)="cancel()"></div>

<!-- Panel -->
<div class="pk-panel" role="dialog">

  <!-- Header -->
  <div class="pk-header">
    <span class="pk-title">{{ title }}</span>
    <button class="pk-close" (click)="cancel()">
      <mat-icon>close</mat-icon>
    </button>
  </div>

  <!-- Search -->
  <div class="pk-search">
    <mat-icon class="pk-search-icon">search</mat-icon>
    <input class="pk-search-input" type="text" [placeholder]="'חיפוש ' + title + '...'"
           [(ngModel)]="searchText" (ngModelChange)="onSearch()" autofocus />
    @if (searchText) {
      <button class="pk-clear" (click)="searchText=''; onSearch()">
        <mat-icon>close</mat-icon>
      </button>
    }
    <span class="pk-count">{{ filtered().length }}</span>
  </div>

  <!-- List -->
  <div class="pk-list">
    @for (item of paged(); track item.id) {
      <div class="pk-row" [class.pk-selected]="selected()?.id === item.id"
           (click)="select(item)">
        <div class="pk-avatar">{{ (item.name || '#').charAt(0) }}</div>
        <div class="pk-info">
          <span class="pk-name">{{ item.name || '(ללא שם)' }}</span>
          @if (item.extra) { <span class="pk-extra">{{ item.extra }}</span> }
        </div>
        @if (item.badge) { <span class="pk-badge">{{ item.badge }}</span> }
        @if (selected()?.id === item.id) {
          <mat-icon class="pk-check">check_circle</mat-icon>
        }
      </div>
    }
    @if (filtered().length === 0) {
      <div class="pk-empty">לא נמצאו תוצאות</div>
    }
  </div>

  <!-- Pager -->
  @if (filtered().length > pageSize) {
    <div class="pk-pager">
      <button class="pk-page-btn" [disabled]="page === 0" (click)="page=page-1">
        <mat-icon>chevron_right</mat-icon>
      </button>
      <span class="pk-page-info">{{ page + 1 }} / {{ totalPages() }}</span>
      <button class="pk-page-btn" [disabled]="page >= totalPages()-1" (click)="page=page+1">
        <mat-icon>chevron_left</mat-icon>
      </button>
    </div>
  }

  <!-- Footer -->
  <div class="pk-footer">
    <button class="btn-save" [disabled]="!selected()" (click)="confirm()">✓ בחר</button>
    <button class="btn-cancel" (click)="cancel()">ביטול</button>
    @if (selected()) {
      <span class="pk-hint">נבחר: <strong>{{ selected()!.name }}</strong></span>
    }
  </div>

</div>
  `,
  styles: [`
    :host { direction: rtl; }

    .pk-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.18);
      z-index: 1040;
    }

    .pk-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1050;
      width: min(680px, 92vw);
      max-height: 82vh;
      display: flex;
      flex-direction: column;
      background: var(--sf-bg-card);
      border: 1px solid var(--sf-border);
      border-radius: 14px;
      box-shadow: 0 8px 40px rgba(0,0,0,.18);
      overflow: hidden;
    }

    .pk-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: .7rem 1rem;
      border-bottom: 1px solid var(--sf-border);
      flex-shrink: 0;
    }

    .pk-title {
      font-size: .95rem;
      font-weight: 700;
      color: var(--sf-text);
    }

    .pk-close {
      background: none; border: none; cursor: pointer;
      display: flex; align-items: center;
      color: var(--sf-text-muted); border-radius: 6px; padding: 2px;
      mat-icon { font-size: 20px; font-family: 'Material Icons'; }
      &:hover { background: var(--sf-bg-hover); color: var(--sf-text); }
    }

    .pk-search {
      display: flex; align-items: center; gap: .4rem;
      padding: .55rem .75rem;
      border-bottom: 1px solid var(--sf-border);
      flex-shrink: 0;
    }
    .pk-search-icon { font-family: 'Material Icons'; font-size: 18px; color: var(--sf-text-muted); flex-shrink: 0; }
    .pk-search-input {
      flex: 1; border: none; background: none; outline: none;
      font-size: .9rem; color: var(--sf-text); direction: rtl;
      font-family: 'Noto Sans Hebrew', sans-serif;
      &::placeholder { color: var(--sf-text-muted); }
    }
    .pk-clear {
      background: none; border: none; padding: 0; cursor: pointer;
      color: var(--sf-text-muted); display: flex; align-items: center;
      mat-icon { font-size: 16px; font-family: 'Material Icons'; }
      &:hover { color: var(--sf-text); }
    }
    .pk-count {
      font-size: .72rem; color: var(--sf-text-muted);
      background: var(--sf-bg); border: 1px solid var(--sf-border);
      border-radius: 10px; padding: 1px 7px; flex-shrink: 0;
    }

    .pk-list {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }

    .pk-row {
      display: flex; align-items: center; gap: .65rem;
      padding: .55rem .85rem; cursor: pointer;
      border-bottom: 1px solid var(--sf-border);
      transition: background .1s;
      &:last-child { border-bottom: none; }
      &:hover { background: var(--sf-bg-hover); }
      &.pk-selected { background: var(--sf-primary-light); }
    }

    .pk-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      background: var(--sf-primary-light); color: var(--sf-primary);
      display: flex; align-items: center; justify-content: center;
      font-size: .85rem; font-weight: 700; flex-shrink: 0;
    }

    .pk-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .pk-name { font-size: .88rem; font-weight: 500; color: var(--sf-text); }
    .pk-extra { font-size: .74rem; color: var(--sf-text-muted); }

    .pk-badge {
      font-size: .7rem; color: var(--sf-text-muted);
      background: var(--sf-bg); border: 1px solid var(--sf-border);
      border-radius: 6px; padding: 1px 6px; flex-shrink: 0;
      white-space: nowrap; direction: ltr;
    }
    .pk-check { font-family: 'Material Icons'; font-size: 18px; color: var(--sf-primary); flex-shrink: 0; }

    .pk-empty {
      padding: 2.5rem; text-align: center;
      color: var(--sf-text-muted); font-size: .88rem;
    }

    .pk-pager {
      display: flex; align-items: center; justify-content: center;
      gap: .5rem; padding: .4rem;
      border-top: 1px solid var(--sf-border);
      flex-shrink: 0;
    }
    .pk-page-btn {
      background: none; border: 1px solid var(--sf-border); border-radius: 6px;
      padding: .15rem .3rem; cursor: pointer; display: flex; align-items: center;
      mat-icon { font-size: 16px; font-family: 'Material Icons'; }
      &:disabled { opacity: .35; cursor: not-allowed; }
      &:hover:not(:disabled) { background: var(--sf-bg-hover); }
    }
    .pk-page-info { font-size: .78rem; color: var(--sf-text-muted); }

    .pk-footer {
      display: flex; align-items: center; gap: .6rem;
      direction: rtl; padding: .6rem .85rem;
      border-top: 1px solid var(--sf-border);
      flex-shrink: 0;
      background: var(--sf-bg);
    }
    .pk-hint { font-size: .78rem; color: var(--sf-text-secondary); margin-inline-start: auto; }

    .btn-save {
      background: #f97316; color: #fff; border: none; border-radius: 7px;
      padding: .4rem 1rem; font-size: .82rem; font-weight: 700;
      cursor: pointer; font-family: 'Noto Sans Hebrew', sans-serif;
      &:disabled { opacity: .45; cursor: not-allowed; }
      &:hover:not(:disabled) { background: #ea6c0b; }
    }
    .btn-cancel {
      background: none; border: 1px solid var(--sf-border); border-radius: 7px;
      padding: .4rem 1rem; font-size: .82rem; color: var(--sf-text-secondary);
      cursor: pointer; font-family: 'Noto Sans Hebrew', sans-serif;
      &:hover { background: var(--sf-bg-hover); }
    }
  `]
})
export class ListPickerDialogComponent implements OnInit {
  @Input() title  = 'בחירה';
  @Input() items: PickerItem[] = [];

  @Output() selectedItem = new EventEmitter<PickerItem>();
  @Output() cancelled    = new EventEmitter<void>();

  searchText = '';
  page       = 0;
  pageSize   = 15;

  selected = signal<PickerItem | null>(null);

  private _allItems = signal<PickerItem[]>([]);

  filtered = computed(() => {
    if (!this.searchText.trim()) return this._allItems();
    const q = this.searchText.toLowerCase();
    return this._allItems().filter(i =>
      i.name.toLowerCase().includes(q) ||
      (i.extra ?? '').toLowerCase().includes(q)
    );
  });

  totalPages = computed(() => Math.ceil(this.filtered().length / this.pageSize));

  paged = computed(() => {
    const start = this.page * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  ngOnInit() { this._allItems.set(this.items); }

  onSearch() { this.page = 0; }

  select(item: PickerItem) { this.selected.set(item); }

  confirm() {
    if (this.selected()) this.selectedItem.emit(this.selected()!);
  }

  cancel() { this.cancelled.emit(); }

  @HostListener('document:keydown.escape')
  onEscape() { this.cancel(); }
}
