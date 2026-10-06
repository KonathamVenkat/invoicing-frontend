import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  template: `
    @if (auth.session(); as session) {
      <mat-toolbar color="primary">
        <span>MSS Invoicing</span>
        <span class="spacer"></span>
        <span style="font-size: 13px; margin-right: 12px;">{{ session.username }}</span>
        <button mat-icon-button (click)="logout()" matTooltip="Sign out">
          <mat-icon>logout</mat-icon>
        </button>
      </mat-toolbar>
      <mat-sidenav-container class="shell">
        <mat-sidenav mode="side" opened class="sidenav">
          <mat-nav-list>
            <a mat-list-item routerLink="/dashboard" routerLinkActive="active-link">
              <mat-icon matListItemIcon>dashboard</mat-icon>
              <span matListItemTitle>Dashboard</span>
            </a>
            <a mat-list-item routerLink="/invoices" routerLinkActive="active-link">
              <mat-icon matListItemIcon>receipt_long</mat-icon>
              <span matListItemTitle>Invoices</span>
            </a>
            <a mat-list-item routerLink="/customers" routerLinkActive="active-link">
              <mat-icon matListItemIcon>groups</mat-icon>
              <span matListItemTitle>Customers</span>
            </a>
            <a mat-list-item routerLink="/products" routerLinkActive="active-link">
              <mat-icon matListItemIcon>inventory_2</mat-icon>
              <span matListItemTitle>Products &amp; Services</span>
            </a>
            <a mat-list-item routerLink="/company" routerLinkActive="active-link">
              <mat-icon matListItemIcon>domain</mat-icon>
              <span matListItemTitle>Company Settings</span>
            </a>
          </mat-nav-list>
        </mat-sidenav>
        <mat-sidenav-content>
          <router-outlet></router-outlet>
        </mat-sidenav-content>
      </mat-sidenav-container>
    } @else {
      <router-outlet></router-outlet>
    }
  `,
  styles: [
    `
      .shell {
        height: calc(100vh - 64px);
      }
      .sidenav {
        width: 220px;
      }
      .active-link {
        background: rgba(0, 0, 0, 0.06);
      }
    `,
  ],
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
