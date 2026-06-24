import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { GridModule, PageChangeEvent } from '@progress/kendo-angular-grid';
import { DialogModule } from '@progress/kendo-angular-dialog';
import { SortDescriptor, orderBy } from '@progress/kendo-data-query';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { RefdataService, DocumentType } from '../../../core/services/refdata.service';

@Component({
  selector: 'app-document-types',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, GridModule, DialogModule, MatIconModule],
  templateUrl: './document-types.component.html',
  styleUrl: './document-types.component.scss',
})
export class DocumentTypesComponent implements OnInit {
  private fb = new FormBuilder();
  loading = signal(true); error = signal(''); saving = signal(false);
  viewMode = signal(false);
  showDialog = signal(false); editItem = signal<DocumentType | null>(null);
  private allItems = signal<DocumentType[]>([]);
  gridData: DocumentType[] = [];
  sort: SortDescriptor[] = [{ field: 'SortOrder', dir: 'asc' }];
  skip = 0; pageSize = 50; searchTerm = '';

  form = this.fb.group({
    docCode: ['', Validators.required], nameHE: ['', Validators.required],
    nameEN: [''], isMandatory: [false], sortOrder: [0], isActive: [true],
  });

  constructor(private svc: RefdataService, private http: HttpClient) {}
  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.getDocumentTypes().subscribe({
      next: d => { this.allItems.set(d); this.loading.set(false); this.filter(); },
      error: () => { this.error.set('׳©׳’׳™׳׳”'); this.loading.set(false); },
    });
  }

  filter() {
    const q = this.searchTerm.toLowerCase();
    const all = this.allItems();
    this.gridData = orderBy(q ? all.filter(r => r.DocCode.toLowerCase().includes(q) || r.NameHE.includes(q)) : all, this.sort);
    this.skip = 0;
  }

  get pagedData() { return this.gridData.slice(this.skip, this.skip + this.pageSize); }
  onSearch(v: string) { this.searchTerm = v; this.filter(); }
  onSortChange(s: SortDescriptor[]) { this.sort = s; this.filter(); }
  onPageChange(e: PageChangeEvent) { this.skip = e.skip; }

  openNew() {
    this.editItem.set(null);
    this.viewMode.set(false);
    this.form.reset({ docCode:'', nameHE:'', nameEN:'', isMandatory:false, sortOrder:0, isActive:true });
    this.form.enable();
    this.showDialog.set(true);
  }

  openEdit(item: DocumentType) {
    this.editItem.set(item);
    this.viewMode.set(false);
    this.form.patchValue({ docCode:item.DocCode, nameHE:item.NameHE, nameEN:item.NameEN||'', isMandatory:item.IsMandatory, sortOrder:item.SortOrder, isActive:item.IsActive });
    this.form.enable();
    this.showDialog.set(true);
  }

  openView(item: DocumentType) {
    this.editItem.set(item);
    this.viewMode.set(true);
    this.form.patchValue({ docCode:item.DocCode, nameHE:item.NameHE, nameEN:item.NameEN||'', isMandatory:item.IsMandatory, sortOrder:item.SortOrder, isActive:item.IsActive });
    this.form.disable();
    this.showDialog.set(true);
  }

  switchToEdit() { this.viewMode.set(false); this.form.enable(); }

  closeDialog() { this.form.enable(); this.showDialog.set(false); }

  deactivate(item: DocumentType) {
    if (!confirm('לנטרל רשומה זו?')) return;
    this.http.put<any>('/api/refdata/deactivate', { entity: 'document-types', id: item.DocTypeID }).subscribe({
      next: () => this.load(),
      error: (err: any) => alert(err?.error?.message || 'שגיאה'),
    });
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    const v = this.form.value;
    const payload = { docCode:v.docCode, nameHE:v.nameHE, nameEN:v.nameEN||null, isMandatory:!!v.isMandatory, sortOrder:+(v.sortOrder||0), isActive:!!v.isActive };
    const item = this.editItem();
    const call = item ? this.svc.updateDocumentType(item.DocTypeID, payload) : this.svc.createDocumentType(payload);
    call.subscribe({
      next: () => { this.saving.set(false); this.showDialog.set(false); this.load(); },
      error: (err: any) => { this.saving.set(false); alert(err?.error?.message || '׳©׳’׳™׳׳”'); },
    });
  }
}
