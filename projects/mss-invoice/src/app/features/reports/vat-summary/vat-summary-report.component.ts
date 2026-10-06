import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';

import { IconComponent } from '../../../shared/icon/icon.component';
import { ReportService } from '../../../core/services/report.service';
import { VatPeriodTotals, VatSummary } from '../../../core/models/report.model';

interface VatDisplayRow {
  kind: 'month' | 'quarter';
  data: VatPeriodTotals;
}

@Component({
  selector: 'app-vat-summary-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    IconComponent,
  ],
  templateUrl: './vat-summary-report.component.html',
  styleUrl: './vat-summary-report.component.css',
})
export class VatSummaryReportComponent implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly snackBar = inject(MatSnackBar);

  readonly columns = ['label', 'subtotal', 'vatAmount', 'grandTotal'];
  readonly years = signal<number[]>([]);
  readonly selectedYear = signal<number>(new Date().getFullYear());
  readonly summary = signal<VatSummary | null>(null);
  readonly loading = signal(true);

  readonly displayRows = computed<VatDisplayRow[]>(() => {
    const summary = this.summary();
    if (!summary) return [];
    const rows: VatDisplayRow[] = [];
    for (let quarter = 0; quarter < 4; quarter++) {
      for (let month = quarter * 3; month < quarter * 3 + 3; month++) {
        rows.push({ kind: 'month', data: summary.months[month] });
      }
      rows.push({ kind: 'quarter', data: summary.quarters[quarter] });
    }
    return rows;
  });

  readonly trackByLabel = (_: number, row: VatDisplayRow) => row.data.label;
  readonly isMonthRow = (_: number, row: VatDisplayRow) => row.kind === 'month';
  readonly isQuarterRow = (_: number, row: VatDisplayRow) => row.kind === 'quarter';

  ngOnInit(): void {
    this.reportService.getYears().subscribe({
      next: (years) => {
        this.years.set(years);
        const defaultYear = years[0] ?? this.selectedYear();
        this.selectedYear.set(defaultYear);
        this.loadSummary(defaultYear);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open("Couldn't load the available years. Refresh the page to try again.", 'Close', {
          duration: 6000,
        });
      },
    });
  }

  onYearChange(year: number): void {
    this.selectedYear.set(year);
    this.loadSummary(year);
  }

  private loadSummary(year: number): void {
    this.loading.set(true);
    this.reportService.getVatSummary(year).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open("Couldn't load the VAT summary. Refresh the page to try again.", 'Close', {
          duration: 6000,
        });
      },
    });
  }
}
