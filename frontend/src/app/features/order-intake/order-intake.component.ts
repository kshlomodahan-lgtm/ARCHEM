import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';

export interface IntakeHeader {
  poNumber: string | null;
  orderDate: string | null;
  printDate: string | null;
  deliveryTerms: string | null;
  paymentTerms: string | null;
  shipMethod: string | null;
  vendorNumber: string | null;
  currency: string | null;
  version: string | null;
}

export interface IntakeParty {
  companyName: string | null;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  country: string | null;
  phone: string | null;
  fax: string | null;
  companyRegNo?: string | null;
  vatNumber?: string | null;
  website?: string | null;
  contactName?: string | null;
  found?: boolean;
  supplierID?: number;
  customerID?: number;
  systemName?: string;
  systemNameHE?: string;
  candidates?: any[];
}

export interface IntakeLine {
  lineNumber: number;
  partNumber: string | null;
  description: string | null;
  dueDate: string | null;
  unitPrice: number | null;
  discount: number | null;
  quantity: number | null;
  unit: string | null;
  currency: string | null;
  extendedPrice: number | null;
  manufacturer: string | null;
  found?: boolean;
  itemID?: number;
  systemItemCode?: string;
  systemName?: string;
  systemNameHE?: string;
  supplierPartNo?: string;
  unitMatch?: boolean | null;
  textMatchScore?: number;
  matchType?: 'exact-part' | 'text' | 'partial';
  candidates?: any[];
  accepted?: boolean;
}

export interface IntakeTotals {
  totalPrice: number | null;
  tax: number | null;
  grandTotal: number | null;
  currency: string | null;
}

export interface IntakeResult {
  header: IntakeHeader;
  fromParty: IntakeParty;
  toParty: IntakeParty;
  lines: IntakeLine[];
  totals: IntakeTotals;
}

interface FieldToggle { key: string; label: string; value: any; accepted: boolean; }
interface NavItem     { id: string; label: string; icon: string; }

@Component({
  selector: 'app-order-intake',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './order-intake.component.html',
  styleUrl: './order-intake.component.scss',
})
export class OrderIntakeComponent {

  selectedFile = signal<File | null>(null);
  analyzing    = signal(false);
  analyzeError = signal('');
  result       = signal<IntakeResult | null>(null);

  activeSection = signal('header');

  readonly navItems: NavItem[] = [
    { id: 'header', label: 'כותרת הזמנה',  icon: 'receipt_long'         },
    { id: 'from',   label: 'מפיק ההזמנה',   icon: 'business'             },
    { id: 'to',     label: 'ספק',            icon: 'local_shipping'       },
    { id: 'lines',  label: 'שורות הזמנה',   icon: 'format_list_numbered' },
  ];

  headerFields = signal<FieldToggle[]>([]);
  fromFields   = signal<FieldToggle[]>([]);
  toFields     = signal<FieldToggle[]>([]);
  lineItems    = signal<IntakeLine[]>([]);

  acceptedLinesCount = computed(() => this.lineItems().filter(l => l.accepted).length);

  selectedTotal = computed(() =>
    this.lineItems()
      .filter(l => l.accepted)
      .reduce((sum, l) => sum + (l.extendedPrice ?? 0), 0)
  );

  constructor(private http: HttpClient) {}

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    if (file && file.type !== 'application/pdf') {
      this.analyzeError.set('יש לבחור קובץ PDF בלבד');
      return;
    }
    this.selectedFile.set(file);
    this.analyzeError.set('');
    this.result.set(null);
  }

  analyze() {
    const file = this.selectedFile();
    if (!file) return;

    this.analyzing.set(true);
    this.analyzeError.set('');
    this.result.set(null);

    const form = new FormData();
    form.append('file', file);

    this.http.post<{ success: boolean; data: IntakeResult; message: string }>(
      '/api/order-intake/analyze', form
    ).subscribe({
      next: r => {
        this.analyzing.set(false);
        if (!r.success) { this.analyzeError.set(r.message); return; }
        this.result.set(r.data);
        this._buildFields(r.data);
        this.activeSection.set('header');
      },
      error: (err: any) => {
        this.analyzing.set(false);
        this.analyzeError.set(err?.error?.message || 'שגיאה בניתוח המסמך');
      },
    });
  }

  private _buildFields(d: IntakeResult) {
    this.headerFields.set([
      { key: 'poNumber',      label: 'מספר הזמנה',      value: d.header.poNumber,      accepted: true },
      { key: 'orderDate',     label: 'תאריך הזמנה',      value: d.header.orderDate,     accepted: true },
      { key: 'deliveryTerms', label: 'תנאי אספקה',       value: d.header.deliveryTerms, accepted: true },
      { key: 'paymentTerms',  label: 'תנאי תשלום',       value: d.header.paymentTerms,  accepted: true },
      { key: 'shipMethod',    label: 'אופן משלוח',       value: d.header.shipMethod,    accepted: true },
      { key: 'currency',      label: 'מטבע',             value: d.header.currency,      accepted: true },
      { key: 'vendorNumber',  label: "קוד ספק (חיצוני)", value: d.header.vendorNumber,  accepted: true },
    ]);

    this.fromFields.set([
      { key: 'companyName',  label: 'שם חברה',   value: d.fromParty?.companyName,  accepted: true },
      { key: 'address',      label: 'כתובת',      value: d.fromParty?.address,      accepted: true },
      { key: 'city',         label: 'עיר',         value: d.fromParty?.city,         accepted: true },
      { key: 'country',      label: 'מדינה',       value: d.fromParty?.country,      accepted: true },
      { key: 'phone',        label: 'טלפון',       value: d.fromParty?.phone,        accepted: true },
      { key: 'companyRegNo', label: 'ח.פ',         value: d.fromParty?.companyRegNo, accepted: true },
      { key: 'website',      label: 'אתר',         value: d.fromParty?.website,      accepted: true },
    ]);

    this.toFields.set([
      { key: 'companyName', label: 'שם ספק',   value: d.toParty?.companyName,  accepted: true },
      { key: 'address',     label: 'כתובת',     value: d.toParty?.address,      accepted: true },
      { key: 'city',        label: 'עיר',        value: d.toParty?.city,         accepted: true },
      { key: 'country',     label: 'מדינה',      value: d.toParty?.country,      accepted: true },
      { key: 'contactName', label: 'איש קשר',   value: d.toParty?.contactName,  accepted: true },
      { key: 'phone',       label: 'טלפון',      value: d.toParty?.phone,        accepted: true },
      { key: 'fax',         label: 'פקס',        value: d.toParty?.fax,          accepted: true },
    ]);

    this.lineItems.set(d.lines.map(l => ({ ...l, accepted: l.found ?? false })));
  }

  private _toggleField(list: FieldToggle[], key: string): FieldToggle[] {
    return list.map(f => f.key === key ? { ...f, accepted: !f.accepted } : f);
  }

  toggleHeaderField(key: string) { this.headerFields.update(l => this._toggleField(l, key)); }
  toggleFromField(key: string)   { this.fromFields.update(l => this._toggleField(l, key)); }
  toggleToField(key: string)     { this.toFields.update(l => this._toggleField(l, key)); }

  toggleLine(idx: number) {
    this.lineItems.update(ls => ls.map((l, i) => i === idx ? { ...l, accepted: !l.accepted } : l));
  }

  selectAll()   { this.lineItems.update(ls => ls.map(l => ({ ...l, accepted: true  }))); }
  deselectAll() { this.lineItems.update(ls => ls.map(l => ({ ...l, accepted: false }))); }

  matchLabel(line: IntakeLine): string {
    if (!line.found) return 'לא נמצא';
    if (line.matchType === 'exact-part') return 'התאמה מדויקת';
    if (line.matchType === 'text')       return 'התאמה טקסטואלית';
    return 'התאמה חלקית';
  }

  matchClass(line: IntakeLine): string {
    if (!line.found) return 'match-none';
    if (line.matchType === 'exact-part') return 'match-exact';
    if (line.matchType === 'text')       return 'match-text';
    return 'match-partial';
  }

  get fileSizeLabel() {
    const f = this.selectedFile();
    if (!f) return '';
    return f.size > 1024 * 1024
      ? `${(f.size / 1024 / 1024).toFixed(1)} MB`
      : `${Math.round(f.size / 1024)} KB`;
  }
}
