import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'app',
    loadComponent: () =>
      import('./shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'orders', pathMatch: 'full' },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/orders/orders.component').then(m => m.OrdersComponent),
      },
      {
        path: 'suppliers',
        loadComponent: () =>
          import('./features/suppliers/suppliers.component').then(m => m.SuppliersComponent),
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./features/customers/customers.component').then(m => m.CustomersComponent),
      },
      {
        path: 'order-intake',
        loadComponent: () =>
          import('./features/order-intake/order-intake.component').then(m => m.OrderIntakeComponent),
      },
      // ── תשתיות מערכת ─────────────────────────────────────────────────
      {
        path: 'refdata/banks',
        loadComponent: () =>
          import('./features/refdata/banks/banks.component').then(m => m.BanksComponent),
      },
      {
        path: 'refdata/customs-brokers',
        loadComponent: () =>
          import('./features/refdata/customs-brokers/customs-brokers.component').then(m => m.CustomsBrokersComponent),
      },
      {
        path: 'refdata/forwarders',
        loadComponent: () =>
          import('./features/refdata/forwarders/forwarders.component').then(m => m.ForwardersComponent),
      },
      {
        path: 'refdata/discount-rules',
        loadComponent: () =>
          import('./features/refdata/discount-rules/discount-rules.component').then(m => m.DiscountRulesComponent),
      },
      {
        path: 'refdata/document-types',
        loadComponent: () =>
          import('./features/refdata/document-types/document-types.component').then(m => m.DocumentTypesComponent),
      },
      {
        path: 'refdata/printer-params',
        loadComponent: () =>
          import('./features/refdata/printer-params/printer-params.component').then(m => m.PrinterParamsComponent),
      },
      {
        path: 'refdata/currency-rates',
        loadComponent: () =>
          import('./features/refdata/currency-rates/currency-rates.component').then(m => m.CurrencyRatesComponent),
      },
      {
        path: 'refdata/countries',
        loadComponent: () =>
          import('./features/refdata/countries/countries.component').then(m => m.CountriesComponent),
      },
      {
        path: 'refdata/uom',
        loadComponent: () =>
          import('./features/refdata/uom/uom.component').then(m => m.UomComponent),
      },
      {
        path: 'refdata/payment-terms',
        loadComponent: () =>
          import('./features/refdata/payment-terms/payment-terms.component').then(m => m.PaymentTermsComponent),
      },
      {
        path: 'refdata/terms-of-sale',
        loadComponent: () =>
          import('./features/refdata/terms-of-sale/terms-of-sale.component').then(m => m.TermsOfSaleComponent),
      },
      {
        path: 'refdata/container-types',
        loadComponent: () =>
          import('./features/refdata/container-types/container-types.component').then(m => m.ContainerTypesComponent),
      },
      {
        path: 'refdata/warehouses',
        loadComponent: () =>
          import('./features/refdata/warehouses/warehouses.component').then(m => m.WarehousesComponent),
      },
      {
        path: 'refdata/import-status',
        loadComponent: () =>
          import('./features/refdata/import-status/import-status.component').then(m => m.ImportStatusComponent),
      },
      {
        path: 'refdata/order-types',
        loadComponent: () =>
          import('./features/refdata/order-types/order-types.component').then(m => m.OrderTypesComponent),
      },
      {
        path: 'refdata/sales-persons',
        loadComponent: () =>
          import('./features/refdata/sales-persons/sales-persons.component').then(m => m.SalesPersonsComponent),
      },
      {
        path: 'refdata/cities',
        loadComponent: () =>
          import('./features/refdata/cities/cities.component').then(m => m.CitiesComponent),
      },
      {
        path: 'refdata/kosher-types',
        loadComponent: () =>
          import('./features/refdata/kosher-types/kosher-types.component').then(m => m.KosherTypesComponent),
      },
      {
        path: 'refdata/item-categories',
        loadComponent: () =>
          import('./features/refdata/item-categories/item-categories.component').then(m => m.ItemCategoriesComponent),
      },
      // ── מקטלג ─────────────────────────────────────────────────────────
      {
        path: 'catalog/attribute-templates',
        loadComponent: () =>
          import('./features/attribute-templates/attribute-templates.component').then(m => m.AttributeTemplatesComponent),
      },
      {
        path: 'catalog/cataloger',
        loadComponent: () =>
          import('./features/cataloger/cataloger.component').then(m => m.CatalogerComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
