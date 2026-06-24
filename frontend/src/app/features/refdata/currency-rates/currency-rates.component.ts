import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { GridModule, PageChangeEvent } from '@progress/kendo-angular-grid';
import { DialogModule } from '@progress/kendo-angular-dialog';
import { SortDescriptor, orderBy } from '@progress/kendo-data-query';
import { MatIconModule } from '@angular/material/icon';
import { RefdataService } from '../../../core/services/refdata.service';

interface CurrencyRow {
  CurrencyID: number;
  CurrencyCode: string;
  CurrencyName: string;
  Symbol: string;
  IsActive: boolean;
  RateID: number | null;
  RateDate: string | null;
  RateToILS: number | null;
  Source: string | null;
  UpdatedAt: string | null;
}

@Component({
  selector: 'app-currency-rates',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, GridModule, DialogModule, MatIconModule],
  templateUrl: './currency-rates.component.html',
  styleUrl: './currency-rates.component.scss',
})
export class CurrencyRatesComponent implements OnInit {
  private fb = new FormBuilder();
  loading = signal(true); error = signal(''); saving = signal(false);
  viewMode = signal(false);
  showDialog = signal(false);
  editItem = signal<CurrencyRow | null>(null);
  private allItems = signal<CurrencyRow[]>([]);
  gridData: CurrencyRow[] = [];
  sort: SortDescriptor[] = [{ field: 'CurrencyCode', dir: 'asc' }];
  skip = 0; pageSize = 50; searchTerm = '';

  form = this.fb.group({
    rateDate:  [this.today(), Validators.required],
    rateToILS: [null as number | null, [Validators.required, Validators.min(0.000001)]],
  });

  constructor(private svc: RefdataService) {}

  ngOnInit() { this.load(); }

  private today() { return new Date().toISOString().slice(0, 10); }

  load() {
    this.loading.set(true);
    this.svc.getCurrencyRates().subscribe({
      next: d => { this.allItems.set(d as any); this.loading.set(false); this.filter(); },
      error: () => { this.error.set('׳©׳’׳™׳׳” ׳‘׳˜׳¢׳™׳ ׳× ׳©׳¢׳¨׳™ ׳׳˜׳‘׳¢'); this.loading.set(false); },
    });
  }

  filter() {
    const q = this.searchTerm.toLowerCase();
    const all = this.allItems() as CurrencyRow[];
    this.gridData = orderBy(
      q ? all.filter(r => r.CurrencyCode.toLowerCase().includes(q) || (r.CurrencyName||'').toLowerCase().includes(q)) : all,
      this.sort
    );
    this.skip = 0;
  }

  get pagedData() { return this.gridData.slice(this.skip, this.skip + this.pageSize); }
  onSearch(v: string) { this.searchTerm = v; this.filter(); }
  onSortChange(s: SortDescriptor[]) { this.sort = s; this.filter(); }
  onPageChange(e: PageChangeEvent) { this.skip = e.skip; }

  openEdit(item: CurrencyRow) {
    this.editItem.set(item);
    this.viewMode.set(false);
    this.form.reset({ rateDate: this.today(), rateToILS: item.RateToILS });
    this.form.enable();
    this.showDialog.set(true);
  }

  openView(item: CurrencyRow) {
    this.editItem.set(item);
    this.viewMode.set(true);
    this.form.reset({ rateDate: this.today(), rateToILS: item.RateToILS });
    this.form.disable();
    this.showDialog.set(true);
  }

  switchToEdit() { this.viewMode.set(false); this.form.enable(); }

  closeDialog() { this.form.enable(); this.showDialog.set(false); this.editItem.set(null); }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const item = this.editItem();
    if (!item) return;
    this.saving.set(true);
    const v = this.form.value;
    this.svc.createCurrencyRate({
      currencyId: item.CurrencyID,
      rateDate: v.rateDate!,
      rateToILS: +(v.rateToILS!),
      source: 'MANUAL',
    }).subscribe({
      next: () => { this.saving.set(false); this.showDialog.set(false); this.editItem.set(null); this.load(); },
      error: (err: any) => { this.saving.set(false); alert(err?.error?.message || '׳©׳’׳™׳׳” ׳‘׳©׳׳™׳¨׳”'); },
    });
  }
}
