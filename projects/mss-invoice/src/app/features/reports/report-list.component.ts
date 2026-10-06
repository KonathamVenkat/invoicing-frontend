import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';

import { IconComponent } from '../../shared/icon/icon.component';

/** Colour of the glossy icon tile; see .tile-icon--* in the component CSS. */
type TileAccent = 'orange' | 'blue' | 'navy' | 'green' | 'red' | 'teal';

interface ReportTile {
  title: string;
  description: string;
  icon: string;
  accent: TileAccent;
  route: string | null;
}

const REPORT_TILES: ReportTile[] = [
  {
    title: 'AR Aging',
    description: 'Outstanding balances per customer, bucketed by days overdue.',
    icon: 'hourglass',
    accent: 'orange',
    route: '/reports/ar-aging',
  },
  {
    title: 'VAT Summary',
    description: 'Subtotal, VAT and total by month or quarter, for VAT filing.',
    icon: 'percent',
    accent: 'blue',
    route: '/reports/vat-summary',
  },
  {
    title: 'Customer Statement',
    description: 'All invoices and running balance for one customer.',
    icon: 'statement',
    accent: 'navy',
    route: '/reports/customer-statement',
  },
  {
    title: 'Product / Service Revenue',
    description: 'Revenue breakdown by product or service.',
    icon: 'trending',
    accent: 'green',
    route: '/reports/product-revenue',
  },
  {
    title: 'Contract Expiry / Renewal',
    description: 'Active, expiring-soon and expired contracts per customer/product.',
    icon: 'calendar',
    accent: 'red',
    route: '/reports/contract-expiry',
  },
  {
    title: 'Invoice Register',
    description: 'Full issued-invoice listing for a period, export-friendly.',
    icon: 'register',
    accent: 'teal',
    route: '/reports/invoice-register',
  },
];

@Component({
  selector: 'app-report-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatCardModule, IconComponent],
  templateUrl: './report-list.component.html',
  styleUrl: './report-list.component.css',
})
export class ReportListComponent {
  readonly tiles = REPORT_TILES;
}
