import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

interface ApiResponse<T> { success: boolean; data: T; message: string; }

// ── Models ────────────────────────────────────────────────────────────────────
export interface Bank {
  BankID: number; BankCode: string; NameHE: string; NameEN: string | null;
  SwiftCode: string | null; BranchNo: string | null; IsActive: boolean;
}
export interface CustomsBroker {
  BrokerID: number; NameHE: string; NameEN: string | null; LicenseNo: string | null;
  ContactName: string | null; Phone: string | null; Email: string | null;
  Address: string | null; IsActive: boolean;
}
export interface Forwarder {
  ForwarderID: number; NameHE: string; NameEN: string | null; ContactName: string | null;
  Phone: string | null; Email: string | null; Country: string | null; IsActive: boolean;
}
export interface DiscountRule {
  DiscountID: number; RuleCode: string; Description: string; DiscountPct: number;
  AppliesTo: string; ValidFrom: string | null; ValidTo: string | null;
  Notes: string | null; IsActive: boolean;
}
export interface DocumentType {
  DocTypeID: number; DocCode: string; NameHE: string; NameEN: string | null;
  IsMandatory: boolean; SortOrder: number; IsActive: boolean;
}
export interface PrinterParam {
  ParamID: number; CompanyID: number | null; ParamKey: string; ParamValue: string | null;
  Description: string | null; SortOrder: number; IsActive: boolean;
}
export interface CurrencyRate {
  RateID: number; CurrencyID: number; CurrencyCode: string; CurrencyName: string;
  Symbol: string; RateDate: string; RateToILS: number; Source: string; CreatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class RefdataService {
  private http = inject(HttpClient);

  // Banks
  getBanks()                     { return this.http.get<ApiResponse<Bank[]>>('/api/refdata/banks').pipe(map(r => r.data)); }
  createBank(b: any)             { return this.http.post<ApiResponse<any>>('/api/refdata/banks', b); }
  updateBank(id: number, b: any) { return this.http.put<ApiResponse<any>>(`/api/refdata/banks/${id}`, b); }

  // Customs Brokers
  getBrokers()                         { return this.http.get<ApiResponse<CustomsBroker[]>>('/api/refdata/customs-brokers').pipe(map(r => r.data)); }
  createBroker(b: any)                 { return this.http.post<ApiResponse<any>>('/api/refdata/customs-brokers', b); }
  updateBroker(id: number, b: any)     { return this.http.put<ApiResponse<any>>(`/api/refdata/customs-brokers/${id}`, b); }

  // Forwarders
  getForwarders()                      { return this.http.get<ApiResponse<Forwarder[]>>('/api/refdata/forwarders').pipe(map(r => r.data)); }
  createForwarder(f: any)              { return this.http.post<ApiResponse<any>>('/api/refdata/forwarders', f); }
  updateForwarder(id: number, f: any)  { return this.http.put<ApiResponse<any>>(`/api/refdata/forwarders/${id}`, f); }

  // Discount Rules
  getDiscountRules()                   { return this.http.get<ApiResponse<DiscountRule[]>>('/api/refdata/discount-rules').pipe(map(r => r.data)); }
  createDiscountRule(d: any)           { return this.http.post<ApiResponse<any>>('/api/refdata/discount-rules', d); }
  updateDiscountRule(id: number, d: any) { return this.http.put<ApiResponse<any>>(`/api/refdata/discount-rules/${id}`, d); }

  // Document Types
  getDocumentTypes()                   { return this.http.get<ApiResponse<DocumentType[]>>('/api/refdata/document-types').pipe(map(r => r.data)); }
  createDocumentType(d: any)           { return this.http.post<ApiResponse<any>>('/api/refdata/document-types', d); }
  updateDocumentType(id: number, d: any) { return this.http.put<ApiResponse<any>>(`/api/refdata/document-types/${id}`, d); }

  // Printer Params
  getPrinterParams()                   { return this.http.get<ApiResponse<PrinterParam[]>>('/api/refdata/printer-params').pipe(map(r => r.data)); }
  createPrinterParam(p: any)           { return this.http.post<ApiResponse<any>>('/api/refdata/printer-params', p); }
  updatePrinterParam(id: number, p: any) { return this.http.put<ApiResponse<any>>(`/api/refdata/printer-params/${id}`, p); }

  // Currency Rates
  getCurrencyRates()                   { return this.http.get<ApiResponse<CurrencyRate[]>>('/api/refdata/currency-rates').pipe(map(r => r.data)); }
  createCurrencyRate(r: any)           { return this.http.post<ApiResponse<any>>('/api/refdata/currency-rates', r); }
  deleteCurrencyRate(id: number)       { return this.http.delete<ApiResponse<any>>(`/api/refdata/currency-rates/${id}`); }
}
