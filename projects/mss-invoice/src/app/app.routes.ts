import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
  },
  {
    path: 'invoices',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/invoices/invoice-list/invoice-list.component').then((m) => m.InvoiceListComponent)
  },
  {
    path: 'invoices/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/invoices/invoice-editor/invoice-editor.component').then((m) => m.InvoiceEditorComponent)
  },
  {
    path: 'invoices/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/invoices/invoice-editor/invoice-editor.component').then((m) => m.InvoiceEditorComponent)
  },
  {
    path: 'customers',
    canActivate: [authGuard],
    loadComponent: () => import('./features/customers/customer-list.component').then((m) => m.CustomerListComponent)
  },
  {
    path: 'products',
    canActivate: [authGuard],
    loadComponent: () => import('./features/products/product-list.component').then((m) => m.ProductListComponent)
  },
  {
    path: 'contracts',
    canActivate: [authGuard],
    loadComponent: () => import('./features/contracts/contract-list.component').then((m) => m.ContractListComponent)
  },
  {
    path: 'reports',
    canActivate: [authGuard],
    loadComponent: () => import('./features/reports/report-list.component').then((m) => m.ReportListComponent)
  },
  {
    path: 'reports/ar-aging',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/ar-aging/ar-aging-report.component').then((m) => m.ArAgingReportComponent)
  },
  {
    path: 'reports/vat-summary',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/vat-summary/vat-summary-report.component').then(
        (m) => m.VatSummaryReportComponent,
      )
  },
  {
    path: 'reports/customer-statement',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/customer-statement/customer-statement-report.component').then(
        (m) => m.CustomerStatementReportComponent,
      )
  },
  {
    path: 'reports/product-revenue',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/product-revenue/product-revenue-report.component').then(
        (m) => m.ProductRevenueReportComponent,
      )
  },
  {
    path: 'reports/contract-expiry',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/contract-expiry/contract-expiry-report.component').then(
        (m) => m.ContractExpiryReportComponent,
      )
  },
  {
    path: 'reports/invoice-register',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/invoice-register/invoice-register-report.component').then(
        (m) => m.InvoiceRegisterReportComponent,
      )
  },
  {
    path: 'company',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/company/company-settings.component').then((m) => m.CompanySettingsComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
