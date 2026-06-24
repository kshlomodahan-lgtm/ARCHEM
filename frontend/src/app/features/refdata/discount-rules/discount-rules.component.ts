import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { GridModule, PageChangeEvent } from '@progress/kendo-angular-grid';
import { DialogModule } from '@progress/kendo-angular-dialog';
import { SortDescriptor, orderBy } from '@progress/kendo-data-query';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { RefdataService, DiscountRule } from '../../../core/services/refdata.service';

@Component({
  selector: 'app-discount-rules',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, GridModule, DialogModule, MatIconModule],
  templateUrl: './discount-rules.component.html',
  styleUrl: './discount-rules.component.scss',
})
export class DiscountRulesComponent implements OnInit {
  private fb = new FormBuilder();
  loading = signal(true); error = signal(''); saving = signal(false);
  viewMode = signal(false);
  showDialog = signal(false); editItem = signal<DiscountRule | null>(null);
  private allItems = signal<DiscountRule[]>([]);
  gridData: DiscountRule[] = [];
  sort: SortDescriptor[] = [{ field: 'RuleCode', dir: 'asc' }];
  skip = 0; pageSize = 50; searchTerm = '';

  readonly appliesOptions = [
    { value:'ALL', label:'׳›׳•׳׳' },
    { value:'SUPPLIER', label:'׳¡׳₪׳§ ׳‘׳׳‘׳“' },
    { value:'CUSTOMER', label:'׳׳§׳•׳— ׳‘׳׳‘׳“' },
  ];

  form = this.fb.group({
    ruleCode: ['', Validators.required], description: ['', Validators.required],
    discountPct: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    appliesTo: ['ALL'], validFrom: [''], validTo: [''], notes: [''], isActive: [true],
  });

  constructor(private svc: RefdataService, private http: HttpClient) {}
  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.getDiscountRules().subscribe({
      next: d => { this.allItems.set(d); this.loading.set(false); this.filter(); },
      error: () => { this.error.set('׳©׳’׳™׳׳”'); this.loading.set(false); },
    });
  }

  filter() {
    const q = this.searchTerm.toLowerCase();
    const all = this.allItems();
    this.gridData = orderBy(q ? all.filter(r => r.RuleCode.toLowerCase().includes(q) || r.Description.includes(q)) : all, this.sort);
    this.skip = 0;
  }

  get pagedData() { return this.gridData.slice(this.skip, this.skip + this.pageSize); }
  onSearch(v: string) { this.searchTerm = v; this.filter(); }
  onSortChange(s: SortDescriptor[]) { this.sort = s; this.filter(); }
  onPageChange(e: PageChangeEvent) { this.skip = e.skip; }

  openNew() {
    this.editItem.set(null);
    this.viewMode.set(false);
    this.form.reset({ ruleCode:'', description:'', discountPct:0, appliesTo:'ALL', validFrom:'', validTo:'', notes:'', isActive:true });
    this.form.enable();
    this.showDialog.set(true);
  }

  openEdit(item: DiscountRule) {
    this.editItem.set(item);
    this.viewMode.set(false);
    this.form.patchValue({ ruleCode:item.RuleCode, description:item.Description, discountPct:item.DiscountPct, appliesTo:item.AppliesTo, validFrom:item.ValidFrom||'', validTo:item.ValidTo||'', notes:item.Notes||'', isActive:item.IsActive });
    this.form.enable();
    this.showDialog.set(true);
  }

  openView(item: DiscountRule) {
    this.editItem.set(item);
    this.viewMode.set(true);
    this.form.patchValue({ ruleCode:item.RuleCode, description:item.Description, discountPct:item.DiscountPct, appliesTo:item.AppliesTo, validFrom:item.ValidFrom||'', validTo:item.ValidTo||'', notes:item.Notes||'', isActive:item.IsActive });
    this.form.disable();
    this.showDialog.set(true);
  }

  switchToEdit() { this.viewMode.set(false); this.form.enable(); }

  closeDialog() { this.form.enable(); this.showDialog.set(false); }

  deactivate(item: DiscountRule) {
    if (!confirm('לנטרל רשומה זו?')) return;
    this.http.put<any>('/api/refdata/deactivate', { entity: 'discount-rules', id: item.DiscountID }).subscribe({
      next: () => this.load(),
      error: (err: any) => alert(err?.error?.message || 'שגיאה'),
    });
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const v = this.form.value;
    const payload = { ruleCode:v.ruleCode, description:v.description, discountPct:+(v.discountPct||0), appliesTo:v.appliesTo||'ALL', validFrom:v.validFrom||null, validTo:v.validTo||null, notes:v.notes||null, isActive:!!v.isActive };
    const item = this.editItem();
    const call = item ? this.svc.updateDiscountRule(item.DiscountID, payload) : this.svc.createDiscountRule(payload);
    call.subscribe({
      next: () => { this.saving.set(false); this.showDialog.set(false); this.load(); },
      error: (err: any) => { this.saving.set(false); alert(err?.error?.message || '׳©׳’׳™׳׳”'); },
    });
  }
}
