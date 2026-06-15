import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';

export interface Country {
  CountryID: number;
  NameHE: string;
  NameEN: string;
  DialCode: string | null;
  CountryCode: string | null;
}

export interface City {
  CityID: number;
  NameHE: string;
  NameEN: string;
  PostalCode: string | null;
}

export interface GeoPoint {
  lat: number;
  lon: number;
  display: string;
}

export interface ContactMethodType {
  MethodTypeID: number;
  NameHE: string;
  NameEN: string;
  Category: string;
  ValueFormat: string;
  Icon: string | null;
  DefaultOrder: number;
}

interface ApiResponse<T> { success: boolean; data: T; message: string; }

@Injectable({ providedIn: 'root' })
export class MetaService {
  private countries$: Observable<Country[]> | null = null;

  constructor(private http: HttpClient) {}

  getCountries(): Observable<Country[]> {
    if (!this.countries$) {
      this.countries$ = this.http
        .get<ApiResponse<Country[]>>('/api/meta/countries')
        .pipe(map(r => r.data), shareReplay(1));
    }
    return this.countries$;
  }

  getCities(countryId: number): Observable<City[]> {
    return this.http
      .get<ApiResponse<City[]>>(`/api/meta/cities/${countryId}`)
      .pipe(map(r => r.data));
  }

  getContactMethodTypes(): Observable<ContactMethodType[]> {
    return this.http
      .get<ApiResponse<ContactMethodType[]>>('/api/meta/contact-method-types')
      .pipe(map(r => r.data));
  }

  geocode(query: string, city?: string, country?: string): Observable<GeoPoint | null> {
    let url = `/api/meta/geocode?q=${encodeURIComponent(query)}`;
    if (city)    url += `&city=${encodeURIComponent(city)}`;
    if (country) url += `&country=${encodeURIComponent(country)}`;
    return this.http
      .get<ApiResponse<GeoPoint | null>>(url)
      .pipe(map(r => r.data));
  }
}
