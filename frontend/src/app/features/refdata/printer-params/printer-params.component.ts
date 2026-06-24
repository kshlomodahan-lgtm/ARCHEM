import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { GridModule, PageChangeEvent } from '@progress/kendo-angular-grid';
import { DialogModule } from '@progress/kendo-angular-dialog';
import { SortDescriptor, orderBy } from '@progress/kendo-data-query';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { RefdataService, PrinterParam } from '../../../core/services/refdata.service';

@Component({
  selector: 'app-printer-params',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, GridModule, DialogModule, MatIconModule],
  templateUrl: './printer-params.component.html',
  styleUrl: './printer-params.component.scss',
})
export class PrinterParamsComponent implements OnInit {
  private fb = new FormBuilder();
  loading = signal(true); error = signal(''); saving = signal(false);
  viewMode = signal(false);
  showDialog = signal(false); editItem = signal<PrinterParam | null>(null);
  private allItems = signal<PrinterParam[]>([]);
  gridData: PrinterParam[] = [];
  sort: SortDescriptor[] = [{ field: 'SortOrder', dir: 'asc' }];
  skip = 0; pageSize = 50; searchTerm = '';

  form = this.fb.group({
    paramKey: ['', Validators.required], paramValue: [''],
    description: [''], sortOrder: [0], isActive: [true],
  });

  constructor(private svc: RefdataService, private http: HttpClient) {}
  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.getPrinterParams().subscribe({
      next: d => { this.allItems.set(d); this.loading.set(false); this.filter(); },
      error: () => { this.error.set('׳©׳’׳™׳׳”'); this.loading.set(false); },
    });
  }

  filter() {
    const q = this.searchTerm.toLowerCase();
    const all = this.allItems();
    this.gridData = orderBy(q ? all.filter(r => r.ParamKey.toLowerCase().includes(q) || (r.Description||'').includes(q)) : all, this.sort);
    this.skip = 0;
  }

  get pagedData() { return this.gridData.slice(this.skip, this.skip + this.pageSize); }
  onSearch(v: string) { this.searchTerm = v; this.filter(); }
  onSortChange(s: SortDescriptor[]) { this.sort = s; this.filter(); }
  onPageChange(e: PageChangeEvent) { this.skip = e.skip; }

  openNew() {
    this.editItem.set(null);
    this.viewMode.set(false);
    this.form.reset({ paramKey:'', paramValue:'', description:'', sortOrder:0, isActive:true });
    this.form.enable();
    this.showDialog.set(true);
  }

  openEdit(item: PrinterParam) {
    this.editItem.set(item);
    this.viewMode.set(false);
    this.form.patchValue({ paramKey:item.ParamKey, paramValue:item.ParamValue||'', description:item.Description||'', sortOrder:item.SortOrder, isActive:item.IsActive });
    this.form.enable();
    this.showDialog.set(true);
  }

  openView(item: PrinterParam) {
    this.editItem.set(item);
    this.viewMode.set(true);
    this.form.patchValue({ paramKey:item.ParamKey, paramValue:item.ParamValue||'', description:item.Description||'', sortOrder:item.SortOrder, isActive:item.IsActive });
    this.form.disable();
    this.showDialog.set(true);
  }

  switchToEdit() { this.viewMode.set(false); this.form.enable(); }

  closeDialog() { this.form.enable(); this.showDialog.set(false); }

  deactivate(item: PrinterParam) {
    if (!confirm('לנטרל רשומה זו?')) return;
    this.http.put<any>('/api/refdata/deactivate', { entity: 'printer-params', id: item.ParamID }).subscribe({
      next: () => this.load(),
      error: (err: any) => alert(err?.error?.message || 'שגיאה'),
    });
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const v = this.form.value;
    const payload = { paramKey:v.paramKey, paramValue:v.paramValue||null, description:v.description||null, sortOrder:+(v.sortOrder||0), isActive:!!v.isActive };
    const item = this.editItem();
    const call = item ? this.svc.updatePrinterParam(item.ParamID, payload) : this.svc.createPrinterParam(payload);
    call.subscribe({
      next: () => { this.saving.set(false); this.showDialog.set(false); this.load(); },
      error: (err: any) => { this.saving.set(false); alert(err?.error?.message || '׳©׳’׳™׳׳”'); },
    });
  }
}
