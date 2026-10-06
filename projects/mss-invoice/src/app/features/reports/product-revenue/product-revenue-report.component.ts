import { CurrencyPipe, DecimalPipe } from '@angular/common';
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
import { ProductRevenueRow } from '../../../core/models/report.model';

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

@Component({
  selector: 'app-product-revenue-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    IconComponent,
  ],
  templateUrl: './product-revenue-report.component.html',
  styleUrl: './product-revenue-report.component.css',
})
export class ProductRevenueReportComponent implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly snackBar = inject(MatSnackBar);

  readonly columns = ['product', 'quantity', 'revenue', 'vatAmount', 'total', 'percentOfTotal'];
  readonly years = signal<number[]>([]);
  readonly selectedYear = signal<number>(new Date().getFullYear());
  readonly rows = signal<ProductRevenueRow[]>([]);
  readonly loading = signal(true);

  readonly trackByProductId = (_: number, row: ProductRevenueRow) => row.productId;

  readonly totals = computed(() => {
    const rows = this.rows();
    return {
      quantity: round3(rows.reduce((sum, r) => sum + r.quantity, 0)),
      revenue: round3(rows.reduce((sum, r) => sum + r.revenue, 0)),
      vatAmount: round3(rows.reduce((sum, r) => sum + r.vatAmount, 0)),
      total: round3(rows.reduce((sum, r) => sum + r.total, 0)),
    };
  });

  ngOnInit(): void {
    this.reportService.getYears().subscribe({
      next: (years) => {
        this.years.set(years);
        const defaultYear = years[0] ?? this.selectedYear();
        this.selectedYear.set(defaultYear);
        this.loadRevenue(defaultYear);
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
    this.loadRevenue(year);
  }

  private loadRevenue(year: number): void {
    this.loading.set(true);
    this.reportService.getProductRevenue(year).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open("Couldn't load the product revenue report. Refresh the page to try again.", 'Close', {
          duration: 6000,
        });
      },
    });
  }
}
