import { Component, signal, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  GridModule, PageChangeEvent, GridComponent,
} from '@progress/kendo-angular-grid';
import { SortDescriptor, orderBy } from '@progress/kendo-data-query';
import { MatIconModule } from '@angular/material/icon';
import { CustomerListItem } from '../../core/models/arachim/customer.model';
import { CustomersService } from '../../core/services/customers.service';
import { CustomerDialogComponent } from './customer-dialog/customer-dialog.component';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, GridModule, MatIconModule, CustomerDialogComponent],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss',
})
export class CustomersComponent implements OnInit {

  @ViewChild('grid') grid!: GridComponent;

  private allItems = signal<CustomerListItem[]>([]);
  expandedIds = new Set<number>();
  loading  = signal(true);
  error    = signal('');

  searchTerm    = '';
  filterActive  = '';
  filterCountry = '';

  gridData: CustomerListItem[] = [];
  sort: SortDescriptor[]       = [{ field: 'shortNameEN', dir: 'asc' }];
  skip     = 0;
  pageSize = 25;

  showDialog = signal(false);
  dialogId   = signal<number | null>(null);

  constructor(private svc: CustomersService) {}

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
        this.error.set('שגיאה בטעינת לקוחות');
        this.loading.set(false);
      },
    });
  }

  get pagedData() {
    return this.gridData.slice(this.skip, this.skip + this.pageSize);
  }

  get uniqueCountries(): string[] {
    const set = new Set(
      this.allItems().map(c => c.primaryCountry).filter((c): c is string => !!c)
    );
    return Array.from(set).sort();
  }

  applyFilters() {
    let data = this.allItems();
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      data = data.filter(c =>
        c.shortNameEN?.toLowerCase().includes(q)  ||
        c.shortNameHE?.toLowerCase().includes(q)  ||
        c.fullNameEN?.toLowerCase().includes(q)   ||
        c.fullNameHE?.toLowerCase().includes(q)   ||
        c.companyRegNo?.toLowerCase().includes(q) ||
        c.primaryPhone?.toLowerCase().includes(q) ||
        c.primaryEmail?.toLowerCase().includes(q) ||
        c.customerID.toString().includes(q),
      );
    }
    if (this.filterActive === '1')  data = data.filter(c => c.isActive);
    if (this.filterActive === '0')  data = data.filter(c => !c.isActive);
    if (this.filterCountry)         data = data.filter(c => c.primaryCountry === this.filterCountry);

    this.gridData = orderBy(data, this.sort) as CustomerListItem[];
    this.skip = 0;
  }

  onSearch(v: string)               { this.searchTerm = v;  this.applyFilters(); }
  onFilterChange()                  { this.applyFilters(); }
  onSortChange(s: SortDescriptor[]) { this.sort = s;        this.applyFilters(); }
  onPageChange(e: PageChangeEvent)  { this.skip = e.skip;   this.pageSize = e.take; }

  clearFilters() {
    this.searchTerm   = '';
    this.filterActive = '';
    this.filterCountry = '';
    this.applyFilters();
  }

  hasActiveFilters() { return !!(this.searchTerm || this.filterActive || this.filterCountry); }

  openNew()                       { this.dialogId.set(null);         this.showDialog.set(true); }
  openEdit(c: CustomerListItem)   { this.dialogId.set(c.customerID); this.showDialog.set(true); }

  onRowDblClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('.k-checkbox-wrap, .act-btn')) return;
    const tr = target.closest('tr.k-master-row') as HTMLElement;
    if (!tr) return;
    const tbody = tr.closest('tbody');
    if (!tbody) return;
    const idx = Array.from(tbody.querySelectorAll('tr.k-master-row')).indexOf(tr);
    if (idx < 0 || idx >= this.pagedData.length) return;
    this.openEdit(this.pagedData[idx]);
  }

  toggleActive(c: CustomerListItem) {
    this.svc.toggleActive(c.customerID).subscribe({ next: () => this.load() });
  }

  toggleDetail(c: CustomerListItem, rowIndex: number) {
    const abs = this.skip + rowIndex;
    if (this.expandedIds.has(c.customerID)) {
      this.expandedIds.delete(c.customerID);
      this.grid.collapseRow(abs);
    } else {
      this.expandedIds.add(c.customerID);
      this.grid.expandRow(abs);
    }
  }

  isExpanded(id: number) { return this.expandedIds.has(id); }

  onDialogSaved()     { this.showDialog.set(false); this.load(); }
  onDialogCancelled() { this.showDialog.set(false); }
}
