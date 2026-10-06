import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api-config';
import { Payment, PaymentTotal } from '../models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/payments`;

  /** All payments recorded against one invoice, oldest first. */
  listForInvoice(invoiceId: number): Observable<Payment[]> {
    const params = new HttpParams().set('invoiceId', invoiceId);
    return this.http.get<Payment[]>(this.baseUrl, { params });
  }

  /** Total paid per invoice, across every invoice with at least one payment — used for
   *  dashboard/report aggregation instead of a request per invoice. */
  getTotals(): Observable<PaymentTotal[]> {
    return this.http.get<PaymentTotal[]>(`${this.baseUrl}/totals`);
  }

  create(payment: Payment): Observable<Payment> {
    return this.http.post<Payment>(this.baseUrl, payment);
  }

  update(id: number, payment: Payment): Observable<Payment> {
    return this.http.put<Payment>(`${this.baseUrl}/${id}`, payment);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
