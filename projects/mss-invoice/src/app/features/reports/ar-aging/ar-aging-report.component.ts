import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';

import { IconComponent } from '../../../shared/icon/icon.component';
import { ReportService } from '../../../core/services/report.service';
import { ArAgingRow } from '../../../core/models/report.model';

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

@Component({
  selector: 'app-ar-aging-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CurrencyPipe, RouterLink, MatButtonModule, MatCardModule, MatTableModule, IconComponent],
  templateUrl: './ar-aging-report.component.html',
  styleUrl: './ar-aging-report.component.css',
})
export class ArAgingReportComponent implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly snackBar = inject(MatSnackBar);

  readonly columns = ['customer', 'current', 'days1To30', 'days31To60', 'days61To90', 'days90Plus', 'total'];
  readonly rows = signal<ArAgingRow[]>([]);
  readonly loading = signal(true);

  readonly trackByCustomerId = (_: number, row: ArAgingRow) => row.customerId;

  readonly totals = computed(() => {
    const rows = this.rows();
    return {
      current: round3(rows.reduce((sum, r) => sum + r.current, 0)),
      days1To30: round3(rows.reduce((sum, r) => sum + r.days1To30, 0)),
      days31To60: round3(rows.reduce((sum, r) => sum + r.days31To60, 0)),
      days61To90: round3(rows.reduce((sum, r) => sum + r.days61To90, 0)),
      days90Plus: round3(rows.reduce((sum, r) => sum + r.days90Plus, 0)),
      total: round3(rows.reduce((sum, r) => sum + r.total, 0)),
    };
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.reportService.getArAging().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open("Couldn't load the AR aging report. Refresh the page to try again.", 'Close', {
          duration: 6000,
        });
      },
    });
  }
}
