import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';

import { IconComponent } from '../../../shared/icon/icon.component';
import { ReportService } from '../../../core/services/report.service';
import { InvoiceRegister, InvoiceRegisterRow } from '../../../core/models/report.model';

// Local-time date helpers — see invoice-editor.component.ts for why these avoid
// toISOString()/new Date(isoString) (both round-trip through UTC and can shift the date).
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Wraps a CSV field in quotes and escapes embedded quotes, only when needed. */
function csvField(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

@Component({
  selector: 'app-invoice-register-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTableModule,
    IconComponent,
  ],
  templateUrl: './invoice-register-report.component.html',
  styleUrl: './invoice-register-report.component.css',
})
export class InvoiceRegisterReportComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly reportService = inject(ReportService);
  private readonly snackBar = inject(MatSnackBar);

  readonly columns = ['invoiceNumber', 'invoiceDate', 'customerName', 'subtotal', 'vatAmount', 'grandTotal'];
  readonly register = signal<InvoiceRegister | null>(null);
  readonly loading = signal(true);

  readonly filterForm = this.fb.group({
    from: this.fb.control<Date | null>(null),
    to: this.fb.control<Date | null>(null),
  });

  readonly filters = toSignal(
    this.filterForm.valueChanges.pipe(map(() => this.filterForm.getRawValue())),
    { initialValue: this.filterForm.getRawValue() },
  );

  readonly hasActiveFilters = computed(() => !!(this.filters().from || this.filters().to));

  readonly trackByInvoiceId = (_: number, row: InvoiceRegisterRow) => row.invoiceId;

  ngOnInit(): void {
    this.load();
    this.filterForm.valueChanges.subscribe(() => this.load());
  }

  clearFilters(): void {
    this.filterForm.reset();
  }

  load(): void {
    const { from, to } = this.filterForm.getRawValue();
    this.loading.set(true);
    this.reportService.getInvoiceRegister(from ? toIsoDate(from) : undefined, to ? toIsoDate(to) : undefined).subscribe({
      next: (register) => {
        this.register.set(register);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open("Couldn't load the invoice register. Refresh the page to try again.", 'Close', {
          duration: 6000,
        });
      },
    });
  }

  exportCsv(): void {
    const register = this.register();
    if (!register || register.lines.length === 0) return;

    const header = ['Invoice Number', 'Invoice Date', 'Due Date', 'Customer', 'Subtotal', 'VAT', 'Grand Total'];
    const rows = register.lines.map((line) => [
      csvField(line.invoiceNumber),
      csvField(line.invoiceDate),
      csvField(line.dueDate ?? ''),
      csvField(line.customerName),
      csvField(line.subtotal.toFixed(3)),
      csvField(line.vatAmount.toFixed(3)),
      csvField(line.grandTotal.toFixed(3)),
    ]);
    const csv = [header, ...rows].map((row) => row.join(',')).join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-register${register.from ? '-' + register.from : ''}${register.to ? '-' + register.to : ''}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
