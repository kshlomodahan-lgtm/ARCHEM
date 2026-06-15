export interface SupplierListItem {
  supplierID: number;
  shortNameEN: string | null;
  shortNameHE: string | null;
  fullNameEN: string | null;
  fullNameHE: string | null;
  vatNumber: string | null;
  supplierTypeID: number | null;
  isActive: boolean;
  createdAt: string | null;
  primaryPhone: string | null;
  primaryEmail: string | null;
  primaryCity: string | null;
  primaryCountry: string | null;
}

export interface SupplierAddress {
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

export interface SupplierContact {
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

export interface Supplier extends SupplierListItem {
  paymentBankID: number | null;
  psnPrefix: string | null;
  psnNumerator: number | null;
  notes: string | null;
  addresses: SupplierAddress[];
  contactMethods: SupplierContact[];
}
