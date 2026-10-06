import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../api-config';
import { Customer } from '../models/customer.model';
import { PageResponse } from '../models/invoice.model';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/customers`;

  search(name?: string, page = 0, size = 20): Observable<PageResponse<Customer>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (name) {
      params = params.set('name', name);
    }
    return this.http.get<PageResponse<Customer>>(this.baseUrl, { params });
  }

  get(id: number): Observable<Customer> {
    return this.http.get<Customer>(`${this.baseUrl}/${id}`);
  }

  create(customer: Customer): Observable<Customer> {
    return this.http.post<Customer>(this.baseUrl, customer);
  }

  update(id: number, customer: Customer): Observable<Customer> {
    return this.http.put<Customer>(`${this.baseUrl}/${id}`, customer);
  }

  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
