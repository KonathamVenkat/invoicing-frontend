import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { map } from 'rxjs';

import { IconComponent } from '../../../shared/icon/icon.component';
import { InvoiceStatusLabelPipe, invoiceStatusClass } from '../../../shared/invoice-status-label.pipe';
import { InvoiceService } from '../../../core/services/invoice.service';
import { CustomerService } from '../../../core/services/customer.service';
import { Invoice, InvoiceStatus } from '../../../core/models/invoice.model';
import { Customer } from '../../../core/models/customer.model';

// Same local-date convention used in invoice-editor — avoids the UTC round-trip that once
// shifted a selected date back by a day for timezones ahead of UTC (e.g. Oman, UTC+4).
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-invoice-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    CurrencyPipe,
    InvoiceStatusLabelPipe,
    ReactiveFormsModule,
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule,
    MatTooltipModule,
    MatPaginatorModule,
    IconComponent,
  ],
  templateUrl: './invoice-list.component.html',
  styleUrl: './invoice-list.component.css',
})
export class InvoiceListComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly invoiceService = inject(InvoiceService);
  private readonly customerService = inject(CustomerService);
  private readonly snackBar = inject(MatSnackBar);

  readonly columns = ['invoiceNumber', 'invoiceDate', 'customerName', 'grandTotal', 'status', 'actions'];
  readonly invoices = signal<Invoice[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly totalElements = signal(0);
  readonly pageSize = signal(20);
  readonly pageIndex = signal(0);

  readonly statuses: InvoiceStatus[] = ['DRAFT', 'ISSUED', 'CANCELLED'];

  readonly filterForm = this.fb.group({
    customerId: this.fb.control<number | null>(null),
    status: this.fb.control<InvoiceStatus | null>(null),
    fromDate: this.fb.control<Date | null>(null),
    toDate: this.fb.control<Date | null>(null),
  });

  /** Filter values as a signal, so OnPush views update even when a change comes from a
   *  datepicker overlay rather than an event inside this component's template. */
  private readonly filters = toSignal(
    this.filterForm.valueChanges.pipe(map(() => this.filterForm.getRawValue())),
    { initialValue: this.filterForm.getRawValue() },
  );

  readonly hasActiveFilters = computed(() => {
    const { customerId, status, fromDate, toDate } = this.filters();
    return !!(customerId || status || fromDate || toDate);
  });

  private readonly customerNames = computed(
    () => new Map(this.customers().map((c) => [c.id, c.name])),
  );

  /** Keeps table rows (and their focusable buttons) stable across reloads. */
  readonly trackById = (_: number, invoice: Invoice) => invoice.id;

  ngOnInit(): void {
    this.customerService.search(undefined, 0, 100).subscribe({
      next: (r) => this.customers.set(r.content),
      error: () => this.snackBar.open('Failed to load customers', 'Close', { duration: 4000 }),
    });
    this.load();

    // Reacts to any filter control changing, regardless of which Material component drove
    // it (mat-select vs. datepicker) — more robust than wiring a separate (selectionChange)/
    // (dateChange) handler per field, and avoids relying on each component's specific
    // "committed value" event firing exactly when expected.
    this.filterForm.valueChanges.subscribe(() => this.applyFilters());
  }

  load(): void {
    const { customerId, status, fromDate, toDate } = this.filterForm.getRawValue();
    this.invoiceService
      .search({
        customerId: customerId ?? undefined,
        status: status ?? undefined,
        fromDate: fromDate ? toIsoDate(fromDate) : undefined,
        toDate: toDate ? toIsoDate(toDate) : undefined,
        page: this.pageIndex(),
        size: this.pageSize(),
      })
      .subscribe({
        next: (result) => {
          this.invoices.set(result.content);
          this.totalElements.set(result.totalElements);
        },
        error: () => this.snackBar.open('Failed to load invoices', 'Close', { duration: 4000 }),
      });
  }

  /** Any filter change resets to page 1 — staying on page 3 of a now-much-shorter
   *  filtered result set would just show an empty page. */
  applyFilters(): void {
    this.pageIndex.set(0);
    this.load();
  }

  clearFilters(): void {
    // valueChanges (subscribed in ngOnInit) picks up this reset and calls applyFilters()
    // automatically — no need to call it again here.
    this.filterForm.reset();
  }

  customerName(customerId: number): string {
    return this.customerNames().get(customerId) ?? '—';
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  readonly statusClass = invoiceStatusClass;

  /** Accessible name for an invoice's row actions; drafts have no number yet. */
  invoiceLabel(invoice: Invoice): string {
    return invoice.invoiceNumber ?? `draft dated ${invoice.invoiceDate}`;
  }

  issue(invoice: Invoice): void {
    if (!invoice.id) return;
    this.invoiceService.issue(invoice.id).subscribe({
      next: () => {
        this.snackBar.open('Invoice issued', 'Close', { duration: 3000 });
        this.load();
      },
      error: (err: HttpErrorResponse) =>
        this.snackBar.open(err.error?.detail ?? 'Failed to issue invoice', 'Close', { duration: 4000 }),
    });
  }

  downloadPdf(invoice: Invoice): void {
    if (!invoice.id) return;
    this.invoiceService.downloadPdf(invoice.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
      },
      error: () => this.snackBar.open('Failed to download PDF', 'Close', { duration: 4000 }),
    });
  }
}
