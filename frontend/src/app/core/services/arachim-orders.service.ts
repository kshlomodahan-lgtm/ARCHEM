import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ArachimOrder, ArachimShipment } from '../models/arachim/order.model';

interface ApiResponse<T> { success: boolean; data: T; message: string; }

export interface OrderFilters {
  year?:          number;
  fromDate?:      string;
  toDate?:        string;
  companyId?:     number;
  supplierId?:    number;
  customerId?:    number;
  salesDomainId?: number;
  showFrozen?:    0 | 1 | 2;
  showCancelled?: 0 | 1 | 2;
  showImportant?: 0 | 1 | 2;
  showFrame?:     0 | 1 | 2;
  search?:        string;
}

@Injectable({ providedIn: 'root' })
export class ArachimOrdersService {

  constructor(private http: HttpClient) {}

  getOrders(filters?: OrderFilters): Observable<ArachimOrder[]> {
    let p = new HttpParams();
    if (filters?.year)          p = p.set('year',          filters.year.toString());
    if (filters?.fromDate)      p = p.set('fromDate',      filters.fromDate);
    if (filters?.toDate)        p = p.set('toDate',        filters.toDate);
    if (filters?.companyId)     p = p.set('companyId',     filters.companyId.toString());
    if (filters?.supplierId)    p = p.set('supplierId',    filters.supplierId.toString());
    if (filters?.customerId)    p = p.set('customerId',    filters.customerId.toString());
    if (filters?.salesDomainId) p = p.set('salesDomainId',filters.salesDomainId.toString());
    if (filters?.showFrozen    !== undefined) p = p.set('showFrozen',    filters.showFrozen.toString());
    if (filters?.showCancelled !== undefined) p = p.set('showCancelled', filters.showCancelled.toString());
    if (filters?.showImportant !== undefined) p = p.set('showImportant', filters.showImportant.toString());
    if (filters?.showFrame     !== undefined) p = p.set('showFrame',     filters.showFrame.toString());
    if (filters?.search)        p = p.set('search',        filters.search);

    return this.http
      .get<ApiResponse<ArachimOrder[]>>('/api/orders', { params: p })
      .pipe(map(r => this.parseOrders(r.data)));
  }

  getOrder(orderId: number): Observable<ArachimOrder> {
    return this.http
      .get<ApiResponse<ArachimOrder>>(`/api/orders/${orderId}`)
      .pipe(map(r => this.parseOrder(r.data)));
  }

  createOrder(payload: { header: any; lines: any[] }): Observable<{ orderId: number }> {
    return this.http.post<ApiResponse<any>>('/api/orders', payload).pipe(map(r => r.data));
  }

  updateOrder(orderId: number, payload: { header: any; lines?: any[] }): Observable<void> {
    return this.http.put<ApiResponse<any>>(`/api/orders/${orderId}`, payload).pipe(map(() => undefined));
  }

  deactivateOrder(orderId: number): Observable<void> {
    return this.http.patch<ApiResponse<any>>(`/api/orders/${orderId}/deactivate`, {}).pipe(map(() => undefined));
  }

  freezeOrder(orderId: number, isFrozen: boolean, reason?: string): Observable<void> {
    return this.http.patch<ApiResponse<any>>(`/api/orders/${orderId}/freeze`, { isFrozen, reason }).pipe(map(() => undefined));
  }

  cancelOrder(orderId: number, isCancelled: boolean, reason?: string): Observable<void> {
    return this.http.patch<ApiResponse<any>>(`/api/orders/${orderId}/cancel`, { isCancelled, reason }).pipe(map(() => undefined));
  }

  // ── Meta ──────────────────────────────────────────────────────────────────

  getSuppliers(): Observable<{ SupplierID: number; Name: string }[]> {
    return this.http.get<ApiResponse<any[]>>('/api/orders/meta/suppliers').pipe(map(r => r.data));
  }

  getCustomers(): Observable<{ CustomerID: number; Name: string }[]> {
    return this.http.get<ApiResponse<any[]>>('/api/orders/meta/customers').pipe(map(r => r.data));
  }

  getCompanies(): Observable<{ CompanyID: number; Name: string }[]> {
    return this.http.get<ApiResponse<any[]>>('/api/orders/meta/companies').pipe(map(r => r.data));
  }

  getCurrencies(): Observable<{ CurrencyID: number; CurrencyCode: string; Symbol: string; Name: string }[]> {
    return this.http.get<ApiResponse<any[]>>('/api/orders/meta/currencies').pipe(map(r => r.data));
  }

  getSalesDomains(): Observable<{ SalesDomainID: number; DomainName: string; DomainPrefix: string }[]> {
    return this.http.get<ApiResponse<any[]>>('/api/orders/meta/sales-domains').pipe(map(r => r.data));
  }

  getEditors(): Observable<{ SalesPersonID: number; NameHE: string; NameEN: string }[]> {
    return this.http.get<ApiResponse<any[]>>('/api/orders/meta/editors').pipe(map(r => r.data));
  }

  getPaymentTerms(): Observable<{ PaymentTermID: number; Description1: string; CreditDays: number }[]> {
    return this.http.get<ApiResponse<any[]>>('/api/orders/meta/payment-terms').pipe(map(r => r.data));
  }

  getIncoterms(): Observable<{ TOS_ID: number; TOS_Desc: string }[]> {
    return this.http.get<ApiResponse<any[]>>('/api/orders/meta/incoterms').pipe(map(r => r.data));
  }

  getNextOrderNumber(year: number, companyId?: number): Observable<number> {
    let url = `/api/orders/meta/next-order-number?year=${year}`;
    if (companyId) url += `&companyId=${companyId}`;
    return this.http.get<ApiResponse<any>>(url).pipe(map(r => r.data.nextNo));
  }

  // ── Parsers ───────────────────────────────────────────────────────────────

  private parseOrders(raw: ArachimOrder[]): ArachimOrder[] {
    return (raw || []).map(o => this.parseOrder(o));
  }

  private parseOrder(o: ArachimOrder): ArachimOrder {
    return {
      ...o,
      orderDate:    o.orderDate    ? new Date(o.orderDate)    : null,
      deliveryDate: o.deliveryDate ? new Date(o.deliveryDate) : null,
      eta:          o.eta          ? new Date(o.eta)          : null,
      ata:          o.ata          ? new Date(o.ata)          : null,
      lines: (o.lines || []).map(l => ({
        ...l,
        deliveryDate: l.deliveryDate ? new Date(l.deliveryDate) : null,
      })),
      shipment:  o.shipment  ? this.parseShipment(o.shipment) : null,
      financial: o.financial ? {
        ...o.financial,
        supplierInvoiceDate: o.financial.supplierInvoiceDate
          ? new Date(o.financial.supplierInvoiceDate) : null,
      } : null,
    };
  }

  private parseShipment(s: ArachimShipment): ArachimShipment {
    return {
      ...s,
      supplierOCDate:        s.supplierOCDate        ? new Date(s.supplierOCDate)        : null,
      desiredDeliveryDate:   s.desiredDeliveryDate   ? new Date(s.desiredDeliveryDate)   : null,
      updatedDeliveryDate:   s.updatedDeliveryDate   ? new Date(s.updatedDeliveryDate)   : null,
      handoverToShipperDate: s.handoverToShipperDate ? new Date(s.handoverToShipperDate) : null,
      goodsLeftFactoryDate:  s.goodsLeftFactoryDate  ? new Date(s.goodsLeftFactoryDate)  : null,
      etd: s.etd ? new Date(s.etd) : null,
      eta: s.eta ? new Date(s.eta) : null,
      ata: s.ata ? new Date(s.ata) : null,
    };
  }
}
