import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { GridModule, PageChangeEvent } from '@progress/kendo-angular-grid';
import { DialogModule } from '@progress/kendo-angular-dialog';
import { SortDescriptor, orderBy } from '@progress/kendo-data-query';
import { MatIconModule } from '@angular/material/icon';

interface AttributeTemplate {
  AttributeTemplateID: number;
  TemplateName: string;
  Description: string;
  IsComposite: boolean;
  IsMandatory: boolean;
  IsActive: boolean;
  fieldCount: number;
}

interface AttributeField {
  AttributeFieldID?: number;
  FieldName: string;
  DataType: string;
  IsRequired: boolean;
  DefaultValue?: string;
  MinValue?: number;
  MaxValue?: number;
  MaxLength?: number;
  DisplayOrder: number;
  options?: FieldOption[];
}

interface FieldOption {
  OptionID?: number;
  OptionValue: string;
  DisplayOrder: number;
}

@Component({
  selector: 'app-attribute-templates',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, GridModule, DialogModule, MatIconModule],
  templateUrl: './attribute-templates.component.html',
  styleUrl: './attribute-templates.component.scss',
})
export class AttributeTemplatesComponent implements OnInit {
  private fb = new FormBuilder();

  loading    = signal(true);
  error      = signal('');
  saving     = signal(false);
  viewMode   = signal(false);
  showDialog = signal(false);
  editItem   = signal<AttributeTemplate | null>(null);
  activeTab  = signal<'general' | 'fields'>('general');

  private allItems = signal<AttributeTemplate[]>([]);
  gridData: AttributeTemplate[] = [];
  pagedData: AttributeTemplate[] = [];
  searchText = '';
  sort: SortDescriptor[] = [{ field: 'TemplateName', dir: 'asc' }];
  skip = 0;
  pageSize = 50;

  readonly dataTypes = [
    { value: 'TEXT',      label: 'טקסט' },
    { value: 'NUMBER',    label: 'מספר' },
    { value: 'BOOL',      label: 'כן / לא' },
    { value: 'DATE',      label: 'תאריך' },
    { value: 'LIST',      label: 'רשימה (בחירה אחת)' },
    { value: 'MULTILIST', label: 'רשימה (בחירה מרובה)' },
  ];

  form = this.fb.group({
    templateName: ['', Validators.required],
    description:  [''],
    isComposite:  [false],
    isMandatory:  [false],
    isActive:     [true],
    fields: this.fb.array([]),
  });

  get fieldsArray(): FormArray { return this.form.get('fields') as FormArray; }

  newOptionInputs: string[] = [];
  errorMsg = '';

  constructor(private http: HttpClient) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.http.get<any>('/api/attributes/templates').subscribe({
      next: r => {
        this.allItems.set(r.data);
        this.applyFilter();
        this.loading.set(false);
      },
      error: () => { this.error.set('שגיאה בטעינה'); this.loading.set(false); }
    });
  }

  applyFilter() {
    const q = this.searchText.toLowerCase();
    const filtered = q
      ? this.allItems().filter(t => t.TemplateName.toLowerCase().includes(q) || (t.Description || '').toLowerCase().includes(q))
      : [...this.allItems()];
    this.gridData = orderBy(filtered, this.sort);
    this.skip = 0;
    this.updatePage();
  }

  onSearch(v: string) { this.searchText = v; this.applyFilter(); }
  onSortChange(s: SortDescriptor[]) { this.sort = s; this.applyFilter(); }
  onPageChange(e: PageChangeEvent) { this.skip = e.skip; this.updatePage(); }
  updatePage() { this.pagedData = this.gridData.slice(this.skip, this.skip + this.pageSize); }

  openNew() {
    this.editItem.set(null);
    this.viewMode.set(false);
    this.activeTab.set('general');
    this.form.reset({ templateName: '', description: '', isComposite: false, isMandatory: false, isActive: true });
    this.fieldsArray.clear();
    this.errorMsg = '';
    this.showDialog.set(true);
  }

  openView(item: AttributeTemplate) {
    this.loadAndOpen(item, true);
  }

  openEdit(item: AttributeTemplate) {
    this.loadAndOpen(item, false);
  }

  private loadAndOpen(item: AttributeTemplate, viewOnly: boolean) {
    this.editItem.set(item);
    this.viewMode.set(viewOnly);
    this.activeTab.set('general');
    this.errorMsg = '';
    this.http.get<any>(`/api/attributes/templates/${item.AttributeTemplateID}`).subscribe({
      next: r => {
        const t = r.data;
        this.form.patchValue({
          templateName: t.TemplateName,
          description:  t.Description,
          isComposite:  t.IsComposite,
          isMandatory:  t.IsMandatory,
          isActive:     t.IsActive,
        });
        this.fieldsArray.clear();
        this.newOptionInputs = [];
        (t.fields || []).forEach((f: AttributeField) => {
          this.fieldsArray.push(this.buildFieldGroup(f));
          this.newOptionInputs.push('');
        });
        if (viewOnly) this.form.disable(); else this.form.enable();
        this.showDialog.set(true);
      },
      error: () => { this.error.set('שגיאה בטעינת תבנית'); }
    });
  }

  buildFieldGroup(f?: Partial<AttributeField>): FormGroup {
    return this.fb.group({
      AttributeFieldID: [f?.AttributeFieldID || null],
      FieldName:        [f?.FieldName || '', Validators.required],
      DataType:         [f?.DataType  || 'TEXT', Validators.required],
      IsRequired:       [f?.IsRequired  ?? false],
      DefaultValue:     [f?.DefaultValue || ''],
      MinValue:         [f?.MinValue ?? null],
      MaxValue:         [f?.MaxValue ?? null],
      MaxLength:        [f?.MaxLength ?? null],
      DisplayOrder:     [f?.DisplayOrder ?? 0],
      options:          [f?.options || []],
    });
  }

  addField() {
    this.fieldsArray.push(this.buildFieldGroup());
    this.newOptionInputs.push('');
  }

  removeField(i: number) {
    this.fieldsArray.removeAt(i);
    this.newOptionInputs.splice(i, 1);
  }

  addOption(fieldIdx: number) {
    const val = this.newOptionInputs[fieldIdx]?.trim();
    if (!val) return;
    const fg = this.fieldsArray.at(fieldIdx);
    const opts: FieldOption[] = fg.get('options')?.value || [];
    opts.push({ OptionValue: val, DisplayOrder: opts.length + 1 });
    fg.get('options')?.setValue([...opts]);
    this.newOptionInputs[fieldIdx] = '';
  }

  removeOption(fieldIdx: number, optIdx: number) {
    const fg   = this.fieldsArray.at(fieldIdx);
    const opts = [...(fg.get('options')?.value || [])];
    opts.splice(optIdx, 1);
    fg.get('options')?.setValue(opts);
  }

  switchToEdit() { this.viewMode.set(false); this.form.enable(); }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMsg = 'יש שדות חובה שלא מולאו';
      return;
    }
    this.saving.set(true);
    this.errorMsg = '';
    const v = this.form.value;
    const payload = {
      templateName: v.templateName, description: v.description,
      isComposite: v.isComposite,   isMandatory: v.isMandatory,
      isActive: v.isActive,
    };

    const id = this.editItem()?.AttributeTemplateID;
    const req$ = id
      ? this.http.put<any>(`/api/attributes/templates/${id}`, payload)
      : this.http.post<any>('/api/attributes/templates', payload);

    req$.subscribe({
      next: async r => {
        const tplId = id || r.data?.AttributeTemplateID;
        await this.saveFields(tplId, v.fields as any[]);
        this.saving.set(false);
        this.showDialog.set(false);
        this.load();
      },
      error: e => { this.saving.set(false); this.errorMsg = e.error?.message || 'שגיאה בשמירה'; }
    });
  }

  private async saveFields(tplId: number, fields: any[]) {
    if (!fields?.length) return;
    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      const fp = {
        attributeTemplateId: tplId,
        fieldName: f.FieldName, dataType: f.DataType,
        isRequired: f.IsRequired, defaultValue: f.DefaultValue,
        minValue: f.MinValue, maxValue: f.MaxValue, maxLength: f.MaxLength,
        displayOrder: i,
      };
      let fieldId = f.AttributeFieldID;
      if (fieldId) {
        await this.http.put(`/api/attributes/fields/${fieldId}`, fp).toPromise();
      } else {
        const res: any = await this.http.post('/api/attributes/fields', fp).toPromise();
        fieldId = res?.data?.AttributeFieldID;
      }
      if (fieldId && f.options?.length) {
        for (let j = 0; j < f.options.length; j++) {
          const opt = f.options[j];
          const op = { attributeFieldId: fieldId, optionValue: opt.OptionValue, displayOrder: j };
          if (opt.OptionID) {
            await this.http.put(`/api/attributes/options/${opt.OptionID}`, op).toPromise();
          } else {
            await this.http.post('/api/attributes/options', op).toPromise();
          }
        }
      }
    }
  }

  deactivate(item: AttributeTemplate) {
    if (!confirm(`להשבית תבנית "${item.TemplateName}"?`)) return;
    this.http.delete<any>(`/api/attributes/templates/${item.AttributeTemplateID}`).subscribe({
      next: () => this.load(),
      error: e => this.error.set(e.error?.message || 'שגיאה')
    });
  }

  closeDialog() { this.form.enable(); this.showDialog.set(false); }
  isListType(fg: FormGroup): boolean { const dt = fg.get('DataType')?.value; return dt === 'LIST' || dt === 'MULTILIST'; }
}
