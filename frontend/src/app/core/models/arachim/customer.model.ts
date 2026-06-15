export interface CustomerListItem {
  customerID: number;
  shortNameEN: string | null;
  shortNameHE: string | null;
  fullNameEN: string | null;
  fullNameHE: string | null;
  vatRate: number | null;
  companyRegNo: string | null;
  statusID: number | null;
  defaultCurrencyID: number | null;
  isActive: boolean;
  createdAt: string | null;
  primaryPhone: string | null;
  primaryEmail: string | null;
  primaryCity: string | null;
  primaryCountry: string | null;
}

export interface CustomerAddress {
  entityAddressID: number;
  addressTypeID: number;
  isPrimary: boolean;
  addressID: number;
  line1: string | null;
  line2: string | null;
  cityFree: string | null;
  cityID: number | null;
  stateFree: string | null;
  stateID: number | null;
  zipCode: string | null;
  countryID: number;
  countryNameHE: string | null;
  countryNameEN: string | null;
  countryCode: string | null;
}

export interface CustomerContact {
  entityContactID: number;
  methodTypeID: number;
  methodTypeName: string;
  category: string;
  valueFormat: string;
  icon: string | null;
  dialCountryID: number | null;
  dialCountryName: string | null;
  dialCode: string | null;
  value: string;
  label: string | null;
  isPrimary: boolean;
}

export interface Customer extends CustomerListItem {
  defaultPaymentTermID: number | null;
  defaultSalesDomainID: number | null;
  psnPrefix: string | null;
  psnNumerator: number | null;
  notes: string | null;
  addresses: CustomerAddress[];
  contactMethods: CustomerContact[];
}
