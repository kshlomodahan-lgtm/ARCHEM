import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { GridModule, PageChangeEvent } from '@progress/kendo-angular-grid';
import { DialogModule } from '@progress/kendo-angular-dialog';
import { SortDescriptor, orderBy } from '@progress/kendo-data-query';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-sales-persons',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, GridModule, DialogModule, MatIconModule],
  templateUrl: './sales-persons.component.html',
  styleUrl: './sales-persons.component.scss',
})
export class SalesPersonsComponent implements OnInit {
  private fb = new FormBuilder();
  loading = signal(true); error = signal(''); saving = signal(false);
  viewMode = signal(false);
  showDialog = signal(false); editItem = signal<any>(null);
  private allItems = signal<any[]>([]);
  gridData: any[] = [];
  sort: SortDescriptor[] = [{ field: 'NameHE', dir: 'asc' }];
  skip = 0; pageSize = 50; searchTerm = '';

  form = this.fb.group({
    nameHE: ['', Validators.required],
    nameEN: [''],
    roleCode: ['׳¢'],
    isActive: [true],
  });

  constructor(private http: HttpClient) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<any>('/api/refdata/sales-persons').pipe(map((r: any) => r.data)).subscribe({
      next: d => { this.allItems.set(d); this.loading.set(false); this.filter(); },
      error: () => { this.error.set('׳©׳’׳™׳׳” ׳‘׳˜׳¢׳™׳ ׳”'); this.loading.set(false); },
    });
  }

  filter() {
    const q = this.searchTerm.toLowerCase();
    this.gridData = orderBy(
      q ? this.allItems().filter(r =>
        r.NameHE?.toLowerCase().includes(q) ||
        r.NameEN?.toLowerCase().includes(q)
      ) : this.allItems(),
      this.sort
    );
    this.skip = 0;
  }

  get pagedData() { return this.gridData.slice(this.skip, this.skip + this.pageSize); }
  onSearch(v: string) { this.searchTerm = v; this.filter(); }
  onSortChange(s: SortDescriptor[]) { this.sort = s; this.filter(); }
  onPageChange(e: PageChangeEvent) { this.skip = e.skip; }

  openNew() {
    this.editItem.set(null);
    this.viewMode.set(false);
    this.form.reset({ nameHE: '', nameEN: '', roleCode: '׳¢', isActive: true });
    this.form.enable();
    this.showDialog.set(true);
  }
  openEdit(item: any) {
    this.editItem.set(item);
    this.viewMode.set(false);
    this.form.reset({ nameHE: item.NameHE, nameEN: item.NameEN, roleCode: item.RoleCode, isActive: item.IsActive });
    this.form.enable();
    this.showDialog.set(true);
  }
  openView(item: any) {
    this.editItem.set(item);
    this.viewMode.set(true);
    this.form.reset({ nameHE: item.NameHE, nameEN: item.NameEN, roleCode: item.RoleCode, isActive: item.IsActive });
    this.form.disable();
    this.showDialog.set(true);
  }
  switchToEdit() { this.viewMode.set(false); this.form.enable(); }
  closeDialog() { this.form.enable(); this.showDialog.set(false); }
  deactivate(item: any) {
    if (!confirm('לנטרל רשומה זו?')) return;
    this.http.put<any>('/api/refdata/deactivate', { entity: 'sales-persons', id: item.SalesPersonID }).subscribe({
      next: () => this.load(),
      error: (err: any) => alert(err?.error?.message || 'שגיאה'),
    });
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const v = this.form.value;
    const id = this.editItem()?.SalesPersonID;
    const req = id
      ? this.http.put<any>(`/api/refdata/sales-persons/${id}`, { nameHE: v.nameHE, nameEN: v.nameEN, roleCode: v.roleCode, isActive: v.isActive })
      : this.http.post<any>('/api/refdata/sales-persons', { nameHE: v.nameHE, nameEN: v.nameEN, roleCode: v.roleCode });
    req.subscribe({
      next: () => { this.saving.set(false); this.showDialog.set(false); this.load(); },
      error: (err: any) => { this.saving.set(false); alert(err?.error?.message || '׳©׳’׳™׳׳”'); },
    });
  }
}
