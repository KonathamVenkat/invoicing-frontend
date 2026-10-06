import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api-config';
import { Contract } from '../models/contract.model';
import { PageResponse } from '../models/invoice.model';

@Injectable({ providedIn: 'root' })
export class ContractService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/contracts`;

  /** Paged listing for the Contracts admin screen, optionally filtered. */
  search(customerId?: number, productId?: number, page = 0, size = 20): Observable<PageResponse<Contract>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (customerId != null) {
      params = params.set('customerId', customerId);
    }
    if (productId != null) {
      params = params.set('productId', productId);
    }
    return this.http.get<PageResponse<Contract>>(this.baseUrl, { params });
  }

  /** Full renewal history for one customer+product pair — a handful of rows at most, used
   *  by the invoice editor to preview the contract that will apply before saving. */
  history(customerId: number, productId: number): Observable<PageResponse<Contract>> {
    return this.search(customerId, productId, 0, 50);
  }

  get(id: number): Observable<Contract> {
    return this.http.get<Contract>(`${this.baseUrl}/${id}`);
  }

  create(contract: Contract): Observable<Contract> {
    return this.http.post<Contract>(this.baseUrl, contract);
  }

  update(id: number, contract: Contract): Observable<Contract> {
    return this.http.put<Contract>(`${this.baseUrl}/${id}`, contract);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
