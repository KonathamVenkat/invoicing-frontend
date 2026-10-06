import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';

import { IconComponent } from '../../../shared/icon/icon.component';
import { ContractStatusLabelPipe, contractStatusClass } from '../../../shared/contract-status-label.pipe';
import { ReportService } from '../../../core/services/report.service';
import { ContractExpiryRow } from '../../../core/models/report.model';

@Component({
  selector: 'app-contract-expiry-report',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    ContractStatusLabelPipe,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatTableModule,
    IconComponent,
  ],
  templateUrl: './contract-expiry-report.component.html',
  styleUrl: './contract-expiry-report.component.css',
})
export class ContractExpiryReportComponent implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly snackBar = inject(MatSnackBar);

  readonly columns = ['customerName', 'productName', 'contractCode', 'startDate', 'endDate', 'status'];
  readonly rows = signal<ContractExpiryRow[]>([]);
  readonly loading = signal(true);

  readonly trackByContractId = (_: number, row: ContractExpiryRow) => row.contractId;
  readonly statusClass = contractStatusClass;

  readonly activeCount = computed(() => this.rows().filter((r) => r.status === 'ACTIVE').length);
  readonly expiringSoonCount = computed(() => this.rows().filter((r) => r.status === 'EXPIRING_SOON').length);
  readonly expiredCount = computed(() => this.rows().filter((r) => r.status === 'EXPIRED').length);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.reportService.getContractExpiry().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open("Couldn't load the contract expiry report. Refresh the page to try again.", 'Close', {
          duration: 6000,
        });
      },
    });
  }
}
