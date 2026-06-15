import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Supplier, SupplierListItem } from '../models/arachim/supplier.model';

interface ApiResponse<T> { success: boolean; data: T; message: string; total?: number; }

export interface SupplierSavePayload {
  supplier: {
    shortNameEN: string | null;
    shortNameHE: string | null;
    fullNameEN: string | null;
    fullNameHE: string | null;
    vatNumber: string | null;
    supplierTypeID: number | null;
    paymentBankID: number | null;
    psnPrefix: string | null;
    psnNumerator: number | null;
    notes: string | null;
    isActive: boolean;
  };
  address?: {
    line1: string | null;
    line2: string | null;
    cityID: number | null;
    cityFree: string | null;
    zipCode: string | null;
    countryID: number | null;
  } | null;
  contacts?: Array<{
    methodTypeID?: number;
    category?: string;
    value: string;
    dialCountryID: number | null;
    label: string | null;
    isPrimary: boolean;
  }>;
}

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  constructor(private http: HttpClient) {}

  getAll(search = ''): Observable<SupplierListItem[]> {
    const params = new HttpParams().set('search', search);
    return this.http
      .get<ApiResponse<SupplierListItem[]>>('/api/suppliers', { params })
      .pipe(map(r => r.data));
  }

  getById(id: number): Observable<Supplier> {
    return this.http
      .get<ApiResponse<Supplier>>(`/api/suppliers/${id}`)
      .pipe(map(r => r.data));
  }

  create(payload: SupplierSavePayload): Observable<{ supplierID: number }> {
    return this.http
      .post<ApiResponse<{ supplierID: number }>>('/api/suppliers', payload)
      .pipe(map(r => r.data));
  }

  update(id: number, payload: SupplierSavePayload): Observable<void> {
    return this.http
      .put<ApiResponse<void>>(`/api/suppliers/${id}`, payload)
      .pipe(map(() => undefined));
  }

  deactivate(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`/api/suppliers/${id}`)
      .pipe(map(() => undefined));
  }

  toggleActive(id: number): Observable<void> {
    return this.http
      .patch<ApiResponse<void>>(`/api/suppliers/${id}/toggle-active`, {})
      .pipe(map(() => undefined));
  }

  aiLookup(name: string): Observable<any> {
    return this.http
      .get<ApiResponse<any>>(`/api/suppliers/ai-lookup?name=${encodeURIComponent(name)}`)
      .pipe(map(r => r.data));
  }
}
