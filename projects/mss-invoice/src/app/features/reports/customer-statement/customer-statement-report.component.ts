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
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';

import { IconComponent } from '../../../shared/icon/icon.component';
import { ReportService } from '../../../core/services/report.service';
import { CustomerService } from '../../../core/services/customer.service';
import { Customer } from '../../../core/models/customer.model';
import { CustomerStatement, StatementLine } from '../../../core/models/report.model';

// Local-time date helpers — see invoice-editor.component.ts for why these avoid
// toISOString()/new Date(isoString) (both round-trip through UTC and can shift the date).
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Component({
  selector: 'app-customer-statement-report',
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
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTableModule,
    IconComponent,
  ],
  templateUrl: './customer-statement-report.component.html',
  styleUrl: './customer-statement-report.component.css',
})
export class CustomerStatementReportComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly reportService = inject(ReportService);
  private readonly customerService = inject(CustomerService);
  private readonly snackBar = inject(MatSnackBar);

  readonly columns = ['date', 'type', 'description', 'debit', 'credit', 'balance'];
  readonly customers = signal<Customer[]>([]);
  readonly statement = signal<CustomerStatement | null>(null);
  readonly loading = signal(false);

  readonly filterForm = this.fb.group({
    customerId: this.fb.control<number | null>(null),
    from: this.fb.control<Date | null>(null),
    to: this.fb.control<Date | null>(null),
  });

  readonly filters = toSignal(
    this.filterForm.valueChanges.pipe(map(() => this.filterForm.getRawValue())),
    { initialValue: this.filterForm.getRawValue() },
  );

  readonly hasActiveDateFilter = computed(() => !!(this.filters().from || this.filters().to));

  readonly trackByLine = (index: number, line: StatementLine) => `${line.type}-${line.reference}-${index}`;

  ngOnInit(): void {
    this.customerService.search(undefined, 0, 100).subscribe({
      next: (r) => this.customers.set(r.content),
      error: () =>
        this.snackBar.open(
          "Couldn't load customers, so the Customer list is empty. Refresh the page to try again.",
          'Close',
          { duration: 6000 },
        ),
    });

    this.filterForm.valueChanges.subscribe(() => this.load());
  }

  clearDates(): void {
    this.filterForm.patchValue({ from: null, to: null });
  }

  load(): void {
    const { customerId, from, to } = this.filterForm.getRawValue();
    if (!customerId) {
      this.statement.set(null);
      return;
    }
    this.loading.set(true);
    this.reportService
      .getCustomerStatement(customerId, from ? toIsoDate(from) : undefined, to ? toIsoDate(to) : undefined)
      .subscribe({
        next: (statement) => {
          this.statement.set(statement);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.statement.set(null);
          this.snackBar.open("Couldn't load the customer statement. Refresh the page to try again.", 'Close', {
            duration: 6000,
          });
        },
      });
  }
}
