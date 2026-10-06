import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api-config';
import {
  ArAgingRow,
  ContractExpiryRow,
  CustomerStatement,
  InvoiceRegister,
  ProductRevenueRow,
  VatSummary,
} from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/reports`;

  /** One row per customer with an outstanding balance, bucketed by days overdue. */
  getArAging(): Observable<ArAgingRow[]> {
    return this.http.get<ArAgingRow[]>(`${this.baseUrl}/ar-aging`);
  }

  /** Calendar years with at least one ISSUED invoice, newest first — for a report's year picker. */
  getYears(): Observable<number[]> {
    return this.http.get<number[]>(`${this.baseUrl}/years`);
  }

  /** Subtotal/VAT/total by month and quarter for the given year. */
  getVatSummary(year: number): Observable<VatSummary> {
    const params = new HttpParams().set('year', year);
    return this.http.get<VatSummary>(`${this.baseUrl}/vat-summary`, { params });
  }

  /** One customer's invoice/payment ledger, optionally narrowed to an ISO yyyy-MM-dd range. */
  getCustomerStatement(customerId: number, from?: string, to?: string): Observable<CustomerStatement> {
    let params = new HttpParams().set('customerId', customerId);
    if (from) {
      params = params.set('from', from);
    }
    if (to) {
      params = params.set('to', to);
    }
    return this.http.get<CustomerStatement>(`${this.baseUrl}/customer-statement`, { params });
  }

  /** Revenue per product for the given year, highest revenue first. */
  getProductRevenue(year: number): Observable<ProductRevenueRow[]> {
    const params = new HttpParams().set('year', year);
    return this.http.get<ProductRevenueRow[]>(`${this.baseUrl}/product-revenue`, { params });
  }

  /** Every (customer, product) pair's latest contract, classified active/expiring/expired. */
  getContractExpiry(): Observable<ContractExpiryRow[]> {
    return this.http.get<ContractExpiryRow[]>(`${this.baseUrl}/contract-expiry`);
  }

  /** Every ISSUED invoice, optionally narrowed to an ISO yyyy-MM-dd range. */
  getInvoiceRegister(from?: string, to?: string): Observable<InvoiceRegister> {
    let params = new HttpParams();
    if (from) {
      params = params.set('from', from);
    }
    if (to) {
      params = params.set('to', to);
    }
    return this.http.get<InvoiceRegister>(`${this.baseUrl}/invoice-register`, { params });
  }
}
