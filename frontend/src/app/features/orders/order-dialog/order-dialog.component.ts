import { Component, Input, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { DialogModule } from '@progress/kendo-angular-dialog';
import { DateInputsModule } from '@progress/kendo-angular-dateinputs';
import { DropDownsModule } from '@progress/kendo-angular-dropdowns';
import { InputsModule } from '@progress/kendo-angular-inputs';
import { ButtonsModule } from '@progress/kendo-angular-buttons';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { ArachimOrder, CommissionType } from '../../../core/models/arachim/order.model';
import { ArachimOrdersService } from '../../../core/services/arachim-orders.service';

export interface LineItem {
  orderLineId?: number;
  groupNo: number;
  supplierSKU: string;
  customerSKU: string;
  description: string;
  qtyOrdered: number;
  qtyDispatched: number;
  uom: string;
  price: number;
  discountPct: number;
  lineValue: number;
  deliveryDate: string;
  commissionType: CommissionType;
  commissionPct: number;
  commissionFixed: number;
  commissionPerPrice: number;
  currencyId: number | null;
  isFrameContract: boolean;
}

interface NavGroup { id: string; text: string; icon: string; }

@Component({
  selector: 'app-order-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    DialogModule, DateInputsModule, DropDownsModule, InputsModule,
    ButtonsModule, MatIconModule,
  ],
  templateUrl: './order-dialog.component.html',
  styleUrl:    './order-dialog.component.scss',
})
export class OrderDialogComponent implements OnInit {
  @Input() order: ArachimOrder | null = null;
  @Output() saved     = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private fb   = inject(FormBuilder);
  private svc  = inject(ArachimOrdersService);
  private http = inject(HttpClient);

  activeGroup  = signal('general');
  saving       = signal(false);
  headerSaved  = signal(false);
  savedOrderId = signal<number | null>(null);
  errorMsg     = '';

  suppliers    = signal<{ SupplierID: number; Name: string }[]>([]);
  customers    = signal<{ CustomerID: number; Name: string }[]>([]);
  companies    = signal<{ CompanyID: number; Name: string }[]>([]);
  currencies   = signal<{ CurrencyID: number; Symbol: string; Name: string }[]>([]);
  salesDomains = signal<{ SalesDomainID: number; DomainName: string }[]>([]);
  editors      = signal<{ SalesPersonID: number; NameHE: string }[]>([]);
  paymentTerms = signal<{ PaymentTermID: number; Description1: string; CreditDays: number }[]>([]);
  incoterms    = signal<{ TOS_ID: number; TOS_Desc: string }[]>([]);

  defaultCompanyId = signal<number | null>(null);
  defaultCompanyName = signal<string>('');
  creditDaysDisplay = signal<number | null>(null);

  showSupplierContactPicker = signal(false);
  showCustomerContactPicker = signal(false);
  supplierContacts = signal<string[]>([]);
  customerContacts = signal<string[]>([]);

  lineItems: LineItem[] = [];

  readonly orderTypes = [
    { value: 'PURCHASE', label: 'רכש'     },
    { value: 'SALE',     label: 'מכירה'   },
    { value: 'SERVICE',  label: 'שירות'   },
    { value: 'OTHER',    label: 'אחר'     },
  ];

  readonly commTypes = [
    { value: 'NONE',      label: 'ללא'   },
    { value: 'PCT',       label: '% מחיר' },
    { value: 'FIXED',     label: 'קבועה'  },
    { value: 'PER_PRICE', label: 'לפי מחיר' },
  ];

  readonly transportModes = [
    { value: null, label: 'לא הוגדר' },
    { value: 'A',  label: 'אוויר'     },
    { value: 'Y',  label: 'ים'        },
  ];

  readonly groups: NavGroup[] = [
    { id: 'general',  text: 'כללי',    icon: 'assignment'     },
    { id: 'lines',    text: 'שורות',   icon: 'list_alt'       },
    { id: 'shipment', text: 'משלוח',   icon: 'local_shipping' },
    { id: 'finance',  text: 'פיננסים', icon: 'receipt_long'   },
  ];

  private readonly groupFields: Record<string, string[]> = {
    general:  ['supplierId', 'customerId', 'orderDate'],
    lines:    [],
    shipment: [],
    finance:  [],
  };

  form = this.fb.group({
    orderType:            ['PURCHASE'],
    supplierId:           [null as number | null, Validators.required],
    customerId:           [null as number | null, Validators.required],
    salesDomainId:        [null as number | null],
    customerRef:          [''],
    editorId:             [null as number | null],
    actualEditorId:       [null as number | null],
    supplierContactName:  [''],
    customerContactName:  [''],
    orderYear:            [new Date().getFullYear()],
    orderNumber:          [null as number | null],
    orderDate:            [new Date() as Date | null, Validators.required],
    currencyId:           [1 as number | null],
    paymentTermsId:       [null as number | null],
    incotermsId:          [null as number | null],
    isFrameContract:      [false],
    isImportant:          [false],
    isFrozen:             [false],
    isCancelled:          [false],
    totalValue:           [0],

    supplierOC:          [''],
    supplierOCDate:      [null as Date | null],
    desiredDeliveryDate: [null as Date | null],
    etd:                 [null as Date | null],
    eta:                 [null as Date | null],
    ata:                 [null as Date | null],
    vesselName:          [''],
    blNumber:            [''],
    transportMode:       [null as string | null],

    supplierInvoiceNo:       [''],
    supplierInvoiceDate:     [null as Date | null],
    invoiceAmount:           [0],
    customerPaid:            [false],
    amountPaidByCustomer:    [0],
    invoiceIssuedToSupplier: [false],
    commissionReceived:      [false],
    commissionAmtReceived:   [0],
  });

  get isEdit() { return !!this.order; }
  get title()  { return this.isEdit ? 'עריכת הזמנה' : 'הזמנה חדשה'; }

  ngOnInit() {
    this.svc.getSuppliers().subscribe(d => this.suppliers.set(d));
    this.svc.getCustomers().subscribe(d => this.customers.set(d));
    this.svc.getCompanies().subscribe(d => {
      this.companies.set(d);
      if (d.length > 0 && !this.order) {
        this.defaultCompanyId.set(d[0].CompanyID);
        this.defaultCompanyName.set(d[0].Name);
      }
    });
    this.svc.getCurrencies().subscribe(d => this.currencies.set(d));
    this.svc.getSalesDomains().subscribe(d => this.salesDomains.set(d));
    this.svc.getEditors().subscribe(d => this.editors.set(d));
    this.svc.getPaymentTerms().subscribe(d => this.paymentTerms.set(d));
    this.svc.getIncoterms().subscribe(d => this.incoterms.set(d));

    // Watch paymentTermsId to show credit days
    this.form.get('paymentTermsId')!.valueChanges.subscribe(id => {
      const pt = this.paymentTerms().find(p => p.PaymentTermID === id);
      this.creditDaysDisplay.set(pt?.CreditDays ?? null);
    });

    // Watch orderDate to auto-update year
    this.form.get('orderDate')!.valueChanges.subscribe(d => {
      if (d) this.form.patchValue({ orderYear: new Date(d).getFullYear() }, { emitEvent: false });
    });

    if (this.order) {
      this.defaultCompanyId.set(this.order.companyId);
      this.defaultCompanyName.set(this.order.companyName || '');
      this.patchForm(this.order);
      this.lineItems = this.order.lines.map(l => ({
        orderLineId:        l.orderLineId,
        groupNo:            l.groupNo,
        supplierSKU:        l.supplierSKU,
        customerSKU:        l.customerSKU,
        description:        l.description,
        qtyOrdered:         l.qtyOrdered,
        qtyDispatched:      l.qtyDispatched,
        uom:                l.uom,
        price:              l.price,
        discountPct:        l.discountPct,
        lineValue:          l.lineValue,
        deliveryDate:       l.deliveryDate ? this.toDateStr(l.deliveryDate) : '',
        commissionType:     l.commissionType,
        commissionPct:      l.commissionPct,
        commissionFixed:    l.commissionFixed,
        commissionPerPrice: l.commissionPerPrice ?? 0,
        currencyId:         l.currencyId ?? this.form.value.currencyId ?? null,
        isFrameContract:    l.isFrameContract,
      }));
    } else {
      const year = new Date().getFullYear();
      this.svc.getNextOrderNumber(year).subscribe(n => this.form.patchValue({ orderNumber: n }));
    }
  }

  get currencySymbol(): string {
    const id = this.form.get('currencyId')?.value;
    return this.currencies().find(c => c.CurrencyID === id)?.Symbol || '—';
  }

  toggleFlag(field: string) {
    this.form.get(field)?.setValue(!this.form.get(field)?.value);
  }

  private patchForm(o: ArachimOrder) {
    this.form.patchValue({
      orderType:            (o as any).orderType || 'PURCHASE',
      supplierId:           o.supplierID,
      customerId:           o.customerID,
      salesDomainId:        o.salesDomainId,
      customerRef:          o.customerRef || '',
      editorId:             o.editorId,
      actualEditorId:       (o as any).actualEditorId || null,
      supplierContactName:  o.supplierContactName || '',
      customerContactName:  '',
      orderYear:            o.orderYear,
      orderNumber:         o.orderNumber,
      orderDate:           o.orderDate ? new Date(o.orderDate) : null,
      currencyId:          o.currencyId,
      paymentTermsId:      o.paymentTermsId,
      incotermsId:         o.incotermsId,
      isFrameContract:     o.isFrameContract,
      isImportant:         o.isImportant,
      isFrozen:            o.isFrozen,
      isCancelled:         o.isCancelled,
      totalValue:          o.totalValue,

      supplierOC:          o.shipment?.supplierOC          || '',
      supplierOCDate:      o.shipment?.supplierOCDate      ? new Date(o.shipment.supplierOCDate)      : null,
      desiredDeliveryDate: o.shipment?.desiredDeliveryDate ? new Date(o.shipment.desiredDeliveryDate) : null,
      etd:                 o.shipment?.etd  ? new Date(o.shipment.etd)  : null,
      eta:                 o.shipment?.eta  ? new Date(o.shipment.eta)  : null,
      ata:                 o.shipment?.ata  ? new Date(o.shipment.ata)  : null,
      vesselName:          o.shipment?.vesselName || '',
      blNumber:            o.shipment?.blNumber   || '',
      transportMode:       o.shipment?.transportMode || null,

      supplierInvoiceNo:       o.financial?.supplierInvoiceNo   || '',
      supplierInvoiceDate:     o.financial?.supplierInvoiceDate ? new Date(o.financial.supplierInvoiceDate) : null,
      invoiceAmount:           o.financial?.invoiceAmount        || 0,
      customerPaid:            o.financial?.customerPaid         || false,
      amountPaidByCustomer:    o.financial?.amountPaidByCustomer || 0,
      invoiceIssuedToSupplier: o.financial?.invoiceIssuedToSupplier || false,
      commissionReceived:      o.financial?.commissionReceived   || false,
      commissionAmtReceived:   o.financial?.commissionAmountReceived || 0,
    });
    // Set credit days display
    if (o.creditDays != null) this.creditDaysDisplay.set(o.creditDays);
  }

  onPaymentTermChange(id: number | null) {
    const pt = this.paymentTerms().find(p => p.PaymentTermID === id);
    this.creditDaysDisplay.set(pt?.CreditDays ?? null);
  }

  addLine() {
    this.lineItems.push({
      groupNo: 1, supplierSKU: '', customerSKU: '', description: '',
      qtyOrdered: 1, qtyDispatched: 0, uom: 'יח\'', price: 0, discountPct: 0, lineValue: 0,
      deliveryDate: '', commissionType: 'PCT', commissionPct: 0, commissionFixed: 0,
      commissionPerPrice: 0, currencyId: this.form.value.currencyId ?? null, isFrameContract: false,
    });
    this.activeGroup.set('lines');
  }

  get totalLinesValue(): number {
    return this.lineItems.reduce((s, l) => s + (l.lineValue || 0), 0);
  }

  get totalLinesCommission(): number {
    return this.lineItems.reduce((s, l) => {
      if (l.commissionType === 'PCT')       return s + (l.lineValue * l.commissionPct / 100);
      if (l.commissionType === 'FIXED')     return s + l.commissionFixed;
      if (l.commissionType === 'PER_PRICE') return s + (l.qtyOrdered * l.commissionPerPrice);
      return s;
    }, 0);
  }

  removeLine(i: number) { this.lineItems.splice(i, 1); }

  calcLineValue(line: LineItem) {
    line.lineValue = +(line.qtyOrdered * line.price * (1 - line.discountPct / 100)).toFixed(2);
  }

  saveHeader() {
    const suppCtrl  = this.form.get('supplierId');
    const custCtrl  = this.form.get('customerId');
    const dateCtrl  = this.form.get('orderDate');
    suppCtrl?.markAsTouched(); custCtrl?.markAsTouched(); dateCtrl?.markAsTouched();
    if (suppCtrl?.invalid || custCtrl?.invalid || dateCtrl?.invalid) {
      this.errorMsg = 'יש למלא ספק, לקוח ותאריך לפני שמירת הכותרת';
      return;
    }
    this.errorMsg = '';
    this.saving.set(true);
    const v = this.form.value;
    const header = this.buildHeader(v);
    this.svc.createOrder({ header, lines: [] }).subscribe({
      next: (res: any) => {
        this.saving.set(false);
        this.savedOrderId.set(res.data?.orderId ?? null);
        this.headerSaved.set(true);
        this.activeGroup.set('lines');
      },
      error: (err: any) => {
        this.saving.set(false);
        this.errorMsg = err?.error?.message || 'שגיאה בשמירת הכותרת';
      },
    });
  }

  private buildHeader(v: typeof this.form.value) {
    return {
      orderType:           v.orderType     || 'PURCHASE',
      supplierId:          v.supplierId,
      customerId:          v.customerId,
      companyId:           this.defaultCompanyId() ?? null,
      orderYear:           v.orderYear,
      orderNumber:         v.orderNumber   || null,
      orderDate:           v.orderDate,
      currencyId:          v.currencyId    || 1,
      salesDomainId:       v.salesDomainId || null,
      customerRef:         v.customerRef   || null,
      editorId:            v.editorId      || null,
      actualEditorId:      v.actualEditorId || null,
      paymentTermsId:      v.paymentTermsId || null,
      incotermsId:         v.incotermsId   || null,
      supplierContactName: v.supplierContactName || null,
      customerContactName: v.customerContactName || null,
      isFrameContract:     !!v.isFrameContract,
      isImportant:         !!v.isImportant,
      isFrozen:            !!v.isFrozen,
      isCancelled:         !!v.isCancelled,
      totalValue:          v.totalValue    || 0,
      supplierOC:          v.supplierOC         || null,
      supplierOCDate:      v.supplierOCDate     || null,
      desiredDeliveryDate: v.desiredDeliveryDate|| null,
      etd: v.etd || null, eta: v.eta || null, ata: v.ata || null,
      vesselName:  v.vesselName  || null,
      blNumber:    v.blNumber    || null,
      transportMode: v.transportMode || null,
      supplierInvoiceNo:       v.supplierInvoiceNo       || null,
      supplierInvoiceDate:     v.supplierInvoiceDate     || null,
      invoiceAmount:           v.invoiceAmount            || 0,
      customerPaid:            !!v.customerPaid,
      amountPaidByCustomer:    v.amountPaidByCustomer     || 0,
      invoiceIssuedToSupplier: !!v.invoiceIssuedToSupplier,
      commissionReceived:      !!v.commissionReceived,
      commissionAmtReceived:   v.commissionAmtReceived   || 0,
    };
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.navigateToFirstError();
      this.errorMsg = 'יש שדות חובה שלא מולאו (ספק, לקוח, תאריך)';
      return;
    }
    this.errorMsg = '';
    this.saving.set(true);

    const v      = this.form.value;
    const header = this.buildHeader(v);
    const lines  = this.lineItems.map((l, i) => ({
      ...l,
      lineNo:             i + 1,
      deliveryDate:       l.deliveryDate || null,
      commissionPerPrice: l.commissionPerPrice || 0,
    }));

    const payload = { header, lines };
    let call: Observable<unknown>;
    if (this.isEdit) {
      call = this.svc.updateOrder(this.order!.orderId, payload);
    } else if (this.headerSaved() && this.savedOrderId()) {
      call = this.svc.updateOrder(this.savedOrderId()!, payload);
    } else {
      call = this.svc.createOrder(payload);
    }

    call.subscribe({
      next: () => { this.saving.set(false); this.saved.emit(); },
      error: (err: any) => {
        this.saving.set(false);
        this.errorMsg = err?.error?.message || 'שגיאה בשמירה';
      },
    });
  }

  cancel() { this.cancelled.emit(); }

  private navigateToFirstError() {
    for (const [group, fields] of Object.entries(this.groupFields)) {
      if (fields.some(f => this.form.get(f)?.invalid)) {
        this.activeGroup.set(group);
        return;
      }
    }
  }

  onSupplierChange(id: number | null) {
    this.supplierContacts.set([]);
    if (!id) return;
    this.http.get<any>(`/api/orders/meta/supplier-contacts?supplierId=${id}`)
      .subscribe({ next: r => this.supplierContacts.set(r.data || []) });
  }

  onCustomerChange(id: number | null) {
    this.customerContacts.set([]);
    if (!id) return;
    this.http.get<any>(`/api/orders/meta/customer-contacts?customerId=${id}`)
      .subscribe({ next: r => this.customerContacts.set(r.data || []) });
  }

  openSupplierContactPicker() {
    const id = this.form.get('supplierId')?.value;
    if (!id) return;
    if (!this.supplierContacts().length) {
      this.http.get<any>(`/api/orders/meta/supplier-contacts?supplierId=${id}`)
        .subscribe({ next: r => { this.supplierContacts.set(r.data || []); this.showSupplierContactPicker.set(true); } });
    } else {
      this.showSupplierContactPicker.set(true);
    }
  }

  openCustomerContactPicker() {
    const id = this.form.get('customerId')?.value;
    if (!id) return;
    if (!this.customerContacts().length) {
      this.http.get<any>(`/api/orders/meta/customer-contacts?customerId=${id}`)
        .subscribe({ next: r => { this.customerContacts.set(r.data || []); this.showCustomerContactPicker.set(true); } });
    } else {
      this.showCustomerContactPicker.set(true);
    }
  }

  selectSupplierContact(name: string) {
    this.form.get('supplierContactName')?.setValue(name);
    this.showSupplierContactPicker.set(false);
  }

  selectCustomerContact(name: string) {
    this.form.get('customerContactName')?.setValue(name);
    this.showCustomerContactPicker.set(false);
  }

  private toDateStr(d: Date | string | null): string {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    return dt.toISOString().slice(0, 10);
  }
}
