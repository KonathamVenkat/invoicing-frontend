import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api-config';
import { Invoice, InvoiceRevision, InvoiceStatus, PageResponse } from '../models/invoice.model';

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/invoices`;

  search(filters: {
    customerId?: number;
    status?: InvoiceStatus;
    fromDate?: string;
    toDate?: string;
    page?: number;
    size?: number;
  }): Observable<PageResponse<Invoice>> {
    let params = new HttpParams()
      .set('page', filters.page ?? 0)
      .set('size', filters.size ?? 20);
    if (filters.customerId) params = params.set('customerId', filters.customerId);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.fromDate) params = params.set('fromDate', filters.fromDate);
    if (filters.toDate) params = params.set('toDate', filters.toDate);

    return this.http.get<PageResponse<Invoice>>(this.baseUrl, { params });
  }

  get(id: number): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.baseUrl}/${id}`);
  }

  create(invoice: Invoice): Observable<Invoice> {
    return this.http.post<Invoice>(this.baseUrl, invoice);
  }

  update(id: number, invoice: Invoice): Observable<Invoice> {
    return this.http.put<Invoice>(`${this.baseUrl}/${id}`, invoice);
  }

  issue(id: number): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.baseUrl}/${id}/issue`, {});
  }

  cancel(id: number): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.baseUrl}/${id}/cancel`, {});
  }

  downloadPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/pdf`, { responseType: 'blob' });
  }

  /** Corrects an already-ISSUED invoice (ADMIN only). The pre-edit state is snapshotted
   *  server-side into invoice_revision/invoice_revision_line before the new values apply. */
  correct(id: number, reason: string, invoice: Invoice): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.baseUrl}/${id}/correct`, { reason, invoice });
  }

  getRevisions(id: number): Observable<InvoiceRevision[]> {
    return this.http.get<InvoiceRevision[]>(`${this.baseUrl}/${id}/revisions`);
  }
}
