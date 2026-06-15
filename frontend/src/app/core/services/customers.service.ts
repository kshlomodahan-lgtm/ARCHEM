import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Customer, CustomerListItem } from '../models/arachim/customer.model';

interface ApiResponse<T> { success: boolean; data: T; message: string; total?: number; }

export interface CustomerSavePayload {
  customer: {
    shortNameEN: string | null;
    shortNameHE: string | null;
    fullNameEN: string | null;
    fullNameHE: string | null;
    vatRate: number | null;
    companyRegNo: string | null;
    defaultCurrencyID: number | null;
    defaultPaymentTermID: number | null;
    defaultSalesDomainID: number | null;
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
    methodTypeID: number;
    value: string;
    dialCountryID: number | null;
    label: string | null;
    isPrimary: boolean;
  }>;
}

@Injectable({ providedIn: 'root' })
export class CustomersService {
  constructor(private http: HttpClient) {}

  getAll(search = ''): Observable<CustomerListItem[]> {
    const params = new HttpParams().set('search', search);
    return this.http
      .get<ApiResponse<CustomerListItem[]>>('/api/customers', { params })
      .pipe(map(r => r.data));
  }

  getById(id: number): Observable<Customer> {
    return this.http
      .get<ApiResponse<Customer>>(`/api/customers/${id}`)
      .pipe(map(r => r.data));
  }

  create(payload: CustomerSavePayload): Observable<{ customerID: number }> {
    return this.http
      .post<ApiResponse<{ customerID: number }>>('/api/customers', payload)
      .pipe(map(r => r.data));
  }

  update(id: number, payload: CustomerSavePayload): Observable<void> {
    return this.http
      .put<ApiResponse<void>>(`/api/customers/${id}`, payload)
      .pipe(map(() => undefined));
  }

  deactivate(id: number): Observable<void> {
    return this.http
      .delete<ApiResponse<void>>(`/api/customers/${id}`)
      .pipe(map(() => undefined));
  }

  toggleActive(id: number): Observable<void> {
    return this.http.patch<ApiResponse<void>>(`/api/customers/${id}/toggle-active`, {}).pipe(map(() => undefined));
  }

  aiLookup(name: string): Observable<any> {
    return this.http.get<ApiResponse<any>>(`/api/suppliers/ai-lookup?name=${encodeURIComponent(name)}`).pipe(map(r => r.data));
  }
}
