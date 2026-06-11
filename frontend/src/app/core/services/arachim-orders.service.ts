import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ArachimOrder, ArachimOrderLine, ArachimShipment } from '../models/arachim/order.model';

interface ApiResponse<T> { success: boolean; data: T; message: string; }

@Injectable({ providedIn: 'root' })
export class ArachimOrdersService {

  constructor(private http: HttpClient) {}

  getOrders(params?: {
    year?: number;
    companyId?: number;
    supplierId?: number;
    customerId?: number;
    status?: string;
    search?: string;
  }): Observable<ArachimOrder[]> {
    let p = new HttpParams();
    if (params?.year)       p = p.set('year',       params.year.toString());
    if (params?.companyId)  p = p.set('companyId',  params.companyId.toString());
    if (params?.supplierId) p = p.set('supplierId', params.supplierId.toString());
    if (params?.customerId) p = p.set('customerId', params.customerId.toString());
    if (params?.status)     p = p.set('status',     params.status);
    if (params?.search)     p = p.set('search',     params.search);

    return this.http
      .get<ApiResponse<ArachimOrder[]>>('/api/orders', { params: p })
      .pipe(map(r => this.parseOrders(r.data)));
  }

  getOrder(orderId: number): Observable<ArachimOrder> {
    return this.http
      .get<ApiResponse<ArachimOrder>>(`/api/orders/${orderId}`)
      .pipe(map(r => this.parseOrder(r.data)));
  }

  getSuppliers(): Observable<{ SupplierID: number; Name: string }[]> {
    return this.http
      .get<ApiResponse<any[]>>('/api/orders/meta/suppliers')
      .pipe(map(r => r.data));
  }

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
      shipment: o.shipment ? this.parseShipment(o.shipment) : null,
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
      supplierOCDate:       s.supplierOCDate       ? new Date(s.supplierOCDate)       : null,
      desiredDeliveryDate:  s.desiredDeliveryDate  ? new Date(s.desiredDeliveryDate)  : null,
      updatedDeliveryDate:  s.updatedDeliveryDate  ? new Date(s.updatedDeliveryDate)  : null,
      handoverToShipperDate:s.handoverToShipperDate? new Date(s.handoverToShipperDate): null,
      goodsLeftFactoryDate: s.goodsLeftFactoryDate ? new Date(s.goodsLeftFactoryDate) : null,
      etd: s.etd ? new Date(s.etd) : null,
      eta: s.eta ? new Date(s.eta) : null,
      ata: s.ata ? new Date(s.ata) : null,
    };
  }
}
