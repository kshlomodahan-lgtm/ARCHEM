import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { GridModule, PageChangeEvent } from '@progress/kendo-angular-grid';
import { DialogModule } from '@progress/kendo-angular-dialog';
import { SortDescriptor, orderBy } from '@progress/kendo-data-query';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { RefdataService, Forwarder } from '../../../core/services/refdata.service';

@Component({
  selector: 'app-forwarders',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, GridModule, DialogModule, MatIconModule],
  templateUrl: './forwarders.component.html',
  styleUrl: './forwarders.component.scss',
})
export class ForwardersComponent implements OnInit {
  private fb = new FormBuilder();
  loading = signal(true); error = signal(''); saving = signal(false);
  viewMode = signal(false);
  showDialog = signal(false); editItem = signal<Forwarder | null>(null);
  private allItems = signal<Forwarder[]>([]);
  gridData: Forwarder[] = [];
  sort: SortDescriptor[] = [{ field: 'NameHE', dir: 'asc' }];
  skip = 0; pageSize = 50; searchTerm = '';

  form = this.fb.group({
    nameHE: ['', Validators.required], nameEN: [''], contactName: [''],
    phone: [''], email: [''], country: [''], isActive: [true],
  });

  constructor(private svc: RefdataService, private http: HttpClient) {}
  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.getForwarders().subscribe({
      next: d => { this.allItems.set(d); this.loading.set(false); this.filter(); },
      error: () => { this.error.set('׳©׳’׳™׳׳”'); this.loading.set(false); },
    });
  }

  filter() {
    const q = this.searchTerm.toLowerCase();
    const all = this.allItems();
    this.gridData = orderBy(q ? all.filter(r => r.NameHE.includes(q) || (r.NameEN||'').toLowerCase().includes(q)) : all, this.sort);
    this.skip = 0;
  }

  get pagedData() { return this.gridData.slice(this.skip, this.skip + this.pageSize); }
  onSearch(v: string) { this.searchTerm = v; this.filter(); }
  onSortChange(s: SortDescriptor[]) { this.sort = s; this.filter(); }
  onPageChange(e: PageChangeEvent) { this.skip = e.skip; }

  openNew() {
    this.editItem.set(null);
    this.viewMode.set(false);
    this.form.reset({ nameHE:'', nameEN:'', contactName:'', phone:'', email:'', country:'', isActive:true });
    this.form.enable();
    this.showDialog.set(true);
  }

  openEdit(item: Forwarder) {
    this.editItem.set(item);
    this.viewMode.set(false);
    this.form.patchValue({ nameHE:item.NameHE, nameEN:item.NameEN||'', contactName:item.ContactName||'', phone:item.Phone||'', email:item.Email||'', country:item.Country||'', isActive:item.IsActive });
    this.form.enable();
    this.showDialog.set(true);
  }

  openView(item: Forwarder) {
    this.editItem.set(item);
    this.viewMode.set(true);
    this.form.patchValue({ nameHE:item.NameHE, nameEN:item.NameEN||'', contactName:item.ContactName||'', phone:item.Phone||'', email:item.Email||'', country:item.Country||'', isActive:item.IsActive });
    this.form.disable();
    this.showDialog.set(true);
  }

  switchToEdit() { this.viewMode.set(false); this.form.enable(); }

  closeDialog() { this.form.enable(); this.showDialog.set(false); }

  deactivate(item: Forwarder) {
    if (!confirm('לנטרל רשומה זו?')) return;
    this.http.put<any>('/api/refdata/deactivate', { entity: 'forwarders', id: item.ForwarderID }).subscribe({
      next: () => this.load(),
      error: (err: any) => alert(err?.error?.message || 'שגיאה'),
    });
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const v = this.form.value;
    const payload = { nameHE:v.nameHE, nameEN:v.nameEN||null, contactName:v.contactName||null, phone:v.phone||null, email:v.email||null, country:v.country||null, isActive:!!v.isActive };
    const item = this.editItem();
    const call = item ? this.svc.updateForwarder(item.ForwarderID, payload) : this.svc.createForwarder(payload);
    call.subscribe({
      next: () => { this.saving.set(false); this.showDialog.set(false); this.load(); },
      error: (err: any) => { this.saving.set(false); alert(err?.error?.message || '׳©׳’׳™׳׳”'); },
    });
  }
}
