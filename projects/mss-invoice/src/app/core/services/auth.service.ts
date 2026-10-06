import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, tap } from 'rxjs';

import { API_BASE_URL } from '../api-config';

const SESSION_KEY = 'mss-invoicing-auth';

export interface AuthSession {
  token: string;
  username: string;
  fullName?: string;
  roles: string[];
}

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  username: string;
  fullName?: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly _session = signal<AuthSession | null>(this.readSession());
  readonly session = this._session.asReadonly();

  /**
   * Real login against the backend's Spring Security + JWT endpoint. Callers subscribe and
   * handle the error themselves (e.g. show err.error?.detail from the backend's
   * ProblemDetail body) — this method doesn't swallow failures.
   */
  login(username: string, password: string): Observable<LoginResponse> {
    const body: LoginRequest = { username, password };
    return this.http
      .post<LoginResponse>(`${API_BASE_URL}/auth/login`, body)
      .pipe(tap((response) => this.storeSession(response)));
  }

  logout(): void {
    if (this.isBrowser) {
      sessionStorage.removeItem(SESSION_KEY);
    }
    this._session.set(null);
  }

  isLoggedIn(): boolean {
    return this._session() !== null;
  }

  getToken(): string | null {
    return this._session()?.token ?? null;
  }

  /** e.g. hasRole('ADMIN') — matches against the backend's ROLE_-prefixed authorities. */
  hasRole(role: string): boolean {
    return this._session()?.roles.includes(`ROLE_${role}`) ?? false;
  }

  private storeSession(response: LoginResponse): void {
    const session: AuthSession = {
      token: response.token,
      username: response.username,
      fullName: response.fullName,
      roles: response.roles,
    };
    if (this.isBrowser) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    this._session.set(session);
  }

  private readSession(): AuthSession | null {
    if (!this.isBrowser) {
      return null; // SSR pass: resolved again once running in the browser
    }
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  }
}
