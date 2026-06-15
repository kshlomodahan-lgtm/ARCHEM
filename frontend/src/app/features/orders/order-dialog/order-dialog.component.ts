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
import { ArachimOrder, CommissionType } from '../../../core/models/arachim/order.model';
import { ArachimOrdersService } from '../../../core/services/arachim-orders.service';

export interface LineItem {
  groupNo: number;
  supplierSKU: string;
  customerSKU: string;
  description: string;
  qtyOrdered: number;
  uom: string;
  price: number;
  discountPct: number;
  lineValue: number;
  deliveryDate: string;
  commissionType: CommissionType;
  commissionPct: number;
  commissionFixed: number;
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

  private fb  = inject(FormBuilder);
  private svc = inject(ArachimOrdersService);

  activeGroup = signal('general');
  saving      = signal(false);
  errorMsg    = '';

  suppliers  = signal<{ SupplierID: number; Name: string }[]>([]);
  customers  = signal<{ CustomerID: number; Name: string }[]>([]);
  companies  = signal<{ CompanyID: number; Name: string }[]>([]);
  currencies = signal<{ CurrencyID: number; Symbol: string; Name: string }[]>([]);

  lineItems: LineItem[] = [];

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
    supplierId:    [null as number | null, Validators.required],
    customerId:    [null as number | null, Validators.required],
    companyId:     [null as number | null],
    orderYear:     [new Date().getFullYear()],
    orderNumber:   [null as number | null],
    orderDate:     [new Date() as Date | null, Validators.required],
    currencyId:    [1 as number | null],
    isFrameContract: [false],
    isImportant:   [false],
    totalValue:    [0],

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
    this.svc.getCompanies().subscribe(d => this.companies.set(d));
    this.svc.getCurrencies().subscribe(d => this.currencies.set(d));

    if (this.order) {
      this.patchForm(this.order);
      this.lineItems = this.order.lines.map(l => ({
        groupNo:        l.groupNo,
        supplierSKU:    l.supplierSKU,
        customerSKU:    l.customerSKU,
        description:    l.description,
        qtyOrdered:     l.qtyOrdered,
        uom:            l.uom,
        price:          l.price,
        discountPct:    l.discountPct,
        lineValue:      l.lineValue,
        deliveryDate:   l.deliveryDate ? this.toDateStr(l.deliveryDate) : '',
        commissionType: l.commissionType,
        commissionPct:  l.commissionPct,
        commissionFixed:l.commissionFixed,
        currencyId:     null,
        isFrameContract:l.isFrameContract,
      }));
    } else {
      const year = new Date().getFullYear();
      this.svc.getNextOrderNumber(year).subscribe(n => this.form.patchValue({ orderNumber: n }));
    }
  }

  private patchForm(o: ArachimOrder) {
    this.form.patchValue({
      supplierId:     o.supplierID,
      customerId:     o.customerID,
      companyId:      o.companyId,
      orderYear:      o.orderYear,
      orderNumber:    o.orderNumber,
      orderDate:      o.orderDate ? new Date(o.orderDate) : null,
      isFrameContract:o.isFrameContract,
      isImportant:    o.status === 'important',
      totalValue:     o.totalValue,

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
  }

  addLine() {
    this.lineItems.push({
      groupNo: 1, supplierSKU: '', customerSKU: '', description: '',
      qtyOrdered: 1, uom: 'יח\'', price: 0, discountPct: 0, lineValue: 0,
      deliveryDate: '', commissionType: 'PCT', commissionPct: 0, commissionFixed: 0,
      currencyId: this.form.value.currencyId ?? null, isFrameContract: false,
    });
    this.activeGroup.set('lines');
  }

  removeLine(i: number) { this.lineItems.splice(i, 1); }

  calcLineValue(line: LineItem) {
    line.lineValue = +(line.qtyOrdered * line.price * (1 - line.discountPct / 100)).toFixed(2);
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

    const v = this.form.value;
    const header = {
      supplierId:    v.supplierId,
      customerId:    v.customerId,
      companyId:     v.companyId     || null,
      orderYear:     v.orderYear,
      orderNumber:   v.orderNumber   || null,
      orderDate:     v.orderDate,
      currencyId:    v.currencyId    || 1,
      isFrameContract: !!v.isFrameContract,
      isImportant:   !!v.isImportant,
      totalValue:    v.totalValue    || 0,
      supplierOC:         v.supplierOC         || null,
      supplierOCDate:     v.supplierOCDate     || null,
      desiredDeliveryDate:v.desiredDeliveryDate|| null,
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

    const lines = this.lineItems.map((l, i) => ({
      ...l, lineNo: i + 1,
      deliveryDate: l.deliveryDate || null,
    }));

    const payload = { header, lines };
    const call: Observable<unknown> = this.isEdit
      ? this.svc.updateOrder(this.order!.orderId, payload)
      : this.svc.createOrder(payload);

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

  private toDateStr(d: Date | string | null): string {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    return dt.toISOString().slice(0, 10);
  }
}
