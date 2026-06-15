import { Component, signal, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  GridModule, PageChangeEvent, CellClickEvent, GridComponent,
} from '@progress/kendo-angular-grid';
import { SortDescriptor, orderBy } from '@progress/kendo-data-query';
import { MatIconModule } from '@angular/material/icon';
import { SupplierListItem } from '../../core/models/arachim/supplier.model';
import { SuppliersService } from '../../core/services/suppliers.service';
import { SupplierDialogComponent } from './supplier-dialog/supplier-dialog.component';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule, GridModule, MatIconModule, SupplierDialogComponent],
  templateUrl: './suppliers.component.html',
  styleUrl: './suppliers.component.scss',
})
export class SuppliersComponent implements OnInit {

  @ViewChild('grid') grid!: GridComponent;

  private allItems = signal<SupplierListItem[]>([]);
  expandedIds = new Set<number>();
  loading  = signal(true);
  error    = signal('');

  searchTerm     = '';
  filterActive   = '';
  filterCountry  = '';

  gridData: SupplierListItem[] = [];
  sort: SortDescriptor[]       = [{ field: 'ShortNameEN', dir: 'asc' }];
  skip     = 0;
  pageSize = 25;

  showDialog  = signal(false);
  dialogId    = signal<number | null>(null);

  constructor(private svc: SuppliersService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: items => {
        this.allItems.set(items);
        this.loading.set(false);
        this.applyFilters();
      },
      error: () => {
        this.error.set('שגיאה בטעינת ספקים');
        this.loading.set(false);
      },
    });
  }

  get pagedData() {
    return this.gridData.slice(this.skip, this.skip + this.pageSize);
  }

  get uniqueCountries(): string[] {
    const set = new Set(
      this.allItems().map(s => s.primaryCountry).filter((c): c is string => !!c)
    );
    return Array.from(set).sort();
  }

  applyFilters() {
    let data = this.allItems();
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      data = data.filter(s =>
        s.shortNameEN?.toLowerCase().includes(q)  ||
        s.shortNameHE?.toLowerCase().includes(q)  ||
        s.fullNameEN?.toLowerCase().includes(q)   ||
        s.fullNameHE?.toLowerCase().includes(q)   ||
        s.primaryPhone?.toLowerCase().includes(q) ||
        s.primaryEmail?.toLowerCase().includes(q) ||
        s.supplierID.toString().includes(q),
      );
    }
    if (this.filterActive === '1')  data = data.filter(s => s.isActive);
    if (this.filterActive === '0')  data = data.filter(s => !s.isActive);
    if (this.filterCountry)         data = data.filter(s => s.primaryCountry === this.filterCountry);

    this.gridData = orderBy(data, this.sort) as SupplierListItem[];
    this.skip = 0;
  }

  onSearch(v: string)               { this.searchTerm = v;   this.applyFilters(); }
  onFilterChange()                  { this.applyFilters(); }
  onSortChange(s: SortDescriptor[]) { this.sort = s;         this.applyFilters(); }
  onPageChange(e: PageChangeEvent)  { this.skip = e.skip;    this.pageSize = e.take; }

  clearFilters() {
    this.searchTerm    = '';
    this.filterActive  = '';
    this.filterCountry = '';
    this.applyFilters();
  }

  hasActiveFilters() { return !!(this.searchTerm || this.filterActive || this.filterCountry); }

  openNew()   { this.dialogId.set(null); this.showDialog.set(true); }
  openEdit(s: SupplierListItem) { this.dialogId.set(s.supplierID); this.showDialog.set(true); }

  onCellClick(e: CellClickEvent) {
    const target = e.originalEvent?.target as HTMLElement;
    if (target?.closest('.k-checkbox-wrap') || target?.closest('.grid-act-btn')) return;
    this.openEdit(e.dataItem as SupplierListItem);
  }

  toggleActive(s: SupplierListItem) {
    this.svc.toggleActive(s.supplierID).subscribe({ next: () => this.load() });
  }

  toggleDetail(s: SupplierListItem, rowIndex: number) {
    const abs = this.skip + rowIndex;
    if (this.expandedIds.has(s.supplierID)) {
      this.expandedIds.delete(s.supplierID);
      this.grid.collapseRow(abs);
    } else {
      this.expandedIds.add(s.supplierID);
      this.grid.expandRow(abs);
    }
  }

  isExpanded(id: number) { return this.expandedIds.has(id); }

  onDialogSaved()     { this.showDialog.set(false); this.load(); }
  onDialogCancelled() { this.showDialog.set(false); }
}
