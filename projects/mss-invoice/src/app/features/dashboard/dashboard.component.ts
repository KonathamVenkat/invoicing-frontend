import { CurrencyPipe, DatePipe } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BarChartModule, Color, LegendPosition, PieChartModule, ScaleType } from '@swimlane/ngx-charts';

import { IconComponent } from '../../shared/icon/icon.component';
import { InvoiceStatusLabelPipe, invoiceStatusClass } from '../../shared/invoice-status-label.pipe';
import { InvoiceService } from '../../core/services/invoice.service';
import { CustomerService } from '../../core/services/customer.service';
import { ContractService } from '../../core/services/contract.service';
import { PaymentService } from '../../core/services/payment.service';
import { Invoice } from '../../core/models/invoice.model';
import { Customer } from '../../core/models/customer.model';
import { Contract } from '../../core/models/contract.model';
import { PaymentTotal } from '../../core/models/payment.model';

// Local-time date helpers — see invoice-editor.component.ts for why these avoid
// toISOString()/new Date(isoString) (both round-trip through UTC and can shift the date).
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** The last `count` months, oldest first, as {key: 'yyyy-MM', label: 'MMM yy'} — key matches
 *  the first 7 characters of an ISO invoiceDate for grouping. */
function lastMonths(count: number, from: Date): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    months.push({ key: `${year}-${month}`, label: `${MONTH_LABELS[d.getMonth()]} ${String(year).slice(2)}` });
  }
  return months;
}

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

/**
 * NOTE: summary figures are computed client-side from the most recent 200 invoices, all
 * customers/contracts (small at current volume), and every invoice's total-paid. That's fine
 * at your current data volume; once history grows large, replace this with dedicated backend
 * aggregation endpoints rather than paging through everything here.
 */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    InvoiceStatusLabelPipe,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule,
    IconComponent,
    BarChartModule,
    PieChartModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly invoiceService = inject(InvoiceService);
  private readonly customerService = inject(CustomerService);
  private readonly contractService = inject(ContractService);
  private readonly paymentService = inject(PaymentService);
  private readonly snackBar = inject(MatSnackBar);

  private readonly allInvoices = signal<Invoice[]>([]);
  private readonly customers = signal<Customer[]>([]);
  private readonly contracts = signal<Contract[]>([]);
  private readonly paymentTotals = signal<PaymentTotal[]>([]);

  readonly columns = ['invoiceNumber', 'invoiceDate', 'grandTotal', 'status', 'actions'];

  readonly totalCount = computed(() => this.allInvoices().length);
  readonly draftCount = computed(() => this.allInvoices().filter((i) => i.status === 'DRAFT').length);
  readonly issuedCount = computed(() => this.allInvoices().filter((i) => i.status === 'ISSUED').length);
  readonly cancelledCount = computed(() => this.allInvoices().filter((i) => i.status === 'CANCELLED').length);
  readonly issuedTotal = computed(() =>
    this.allInvoices()
      .filter((i) => i.status === 'ISSUED')
      .reduce((sum, i) => sum + (i.grandTotal ?? 0), 0),
  );
  readonly recentInvoices = computed(() => this.allInvoices().slice(0, 10));

  private readonly paymentTotalsByInvoice = computed(
    () => new Map(this.paymentTotals().map((t) => [t.invoiceId, t.totalPaid])),
  );

  /** Sum of (grandTotal - totalPaid) across ISSUED invoices, floored at zero per invoice so an
   *  accidental overpayment (shouldn't happen — the API blocks it) can't show as negative. */
  readonly outstandingTotal = computed(() =>
    round3(
      this.allInvoices()
        .filter((i) => i.status === 'ISSUED')
        .reduce((sum, i) => {
          const paid = this.paymentTotalsByInvoice().get(i.id!) ?? 0;
          return sum + Math.max((i.grandTotal ?? 0) - paid, 0);
        }, 0),
    ),
  );

  /** ISSUED invoices with an unpaid balance whose due date has already passed. */
  readonly overdueCount = computed(() => {
    const today = toIsoDate(new Date());
    return this.allInvoices().filter((i) => {
      if (i.status !== 'ISSUED' || !i.dueDate || i.dueDate >= today) return false;
      const paid = this.paymentTotalsByInvoice().get(i.id!) ?? 0;
      return (i.grandTotal ?? 0) - paid > 0.0005;
    }).length;
  });

  /** One row per (customer, product) pair — its most recently-ending contract, since a
   *  renewed pair shouldn't also count as "expired" because an old row still exists. */
  private readonly currentContractPerPair = computed(() => {
    const latest = new Map<string, Contract>();
    for (const c of this.contracts()) {
      const key = `${c.customerId}:${c.productId}`;
      const existing = latest.get(key);
      if (!existing || c.endDate > existing.endDate) {
        latest.set(key, c);
      }
    }
    return [...latest.values()];
  });

  readonly contractsExpiringSoonCount = computed(() => {
    const today = toIsoDate(new Date());
    const in30Days = toIsoDate(addDays(new Date(), 30));
    return this.currentContractPerPair().filter((c) => c.endDate >= today && c.endDate <= in30Days).length;
  });

  readonly contractsExpiredCount = computed(() => {
    const today = toIsoDate(new Date());
    return this.currentContractPerPair().filter((c) => c.endDate < today).length;
  });

  private readonly customerNames = computed(() => new Map(this.customers().map((c) => [c.id, c.name])));

  private readonly months = lastMonths(6, new Date());

  readonly revenueTrend = computed(() => {
    const sums = new Map(this.months.map((m) => [m.key, 0]));
    for (const inv of this.allInvoices()) {
      if (inv.status !== 'ISSUED') continue;
      const key = inv.invoiceDate.slice(0, 7);
      if (sums.has(key)) {
        sums.set(key, sums.get(key)! + (inv.grandTotal ?? 0));
      }
    }
    return this.months.map((m) => ({ name: m.label, value: round3(sums.get(m.key)!) }));
  });

  readonly statusBreakdown = computed(() => [
    { name: 'Draft', value: this.draftCount() },
    { name: 'Issued', value: this.issuedCount() },
    { name: 'Cancelled', value: this.cancelledCount() },
  ]);

  readonly topCustomers = computed(() => {
    const totals = new Map<number, number>();
    for (const inv of this.allInvoices()) {
      if (inv.status !== 'ISSUED') continue;
      totals.set(inv.customerId, (totals.get(inv.customerId) ?? 0) + (inv.grandTotal ?? 0));
    }
    const names = this.customerNames();
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, value]) => ({ name: names.get(id) ?? `Customer #${id}`, value: round3(value) }));
  });

  readonly revenueScheme: Color = { name: 'revenue', selectable: false, group: ScaleType.Ordinal, domain: ['#1e3a5f'] };
  readonly topCustomersScheme: Color = {
    name: 'topCustomers',
    selectable: false,
    group: ScaleType.Ordinal,
    domain: ['#2563eb'],
  };
  readonly legendPositionBelow = LegendPosition.Below;
  readonly statusColors = [
    { name: 'Draft', value: '#64748b' },
    { name: 'Issued', value: '#059669' },
    { name: 'Cancelled', value: '#dc2626' },
  ];

  ngOnInit(): void {
    this.invoiceService.search({ page: 0, size: 200 }).subscribe({
      next: (result) => this.allInvoices.set(result.content),
      error: () => this.snackBar.open('Failed to load invoices', 'Close', { duration: 4000 }),
    });
    this.customerService.search(undefined, 0, 100).subscribe({
      next: (result) => this.customers.set(result.content),
      error: () => this.snackBar.open('Failed to load customers', 'Close', { duration: 4000 }),
    });
    this.contractService.search(undefined, undefined, 0, 200).subscribe({
      next: (result) => this.contracts.set(result.content),
      error: () => this.snackBar.open('Failed to load contracts', 'Close', { duration: 4000 }),
    });
    this.paymentService.getTotals().subscribe({
      next: (totals) => this.paymentTotals.set(totals),
      error: () => this.snackBar.open('Failed to load payment totals', 'Close', { duration: 4000 }),
    });
  }

  readonly statusClass = invoiceStatusClass;
}
