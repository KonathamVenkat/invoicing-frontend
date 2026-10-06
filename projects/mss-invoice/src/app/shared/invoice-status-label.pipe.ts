import { Pipe, PipeTransform } from '@angular/core';

import { InvoiceStatus } from '../core/models/invoice.model';

const LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  CANCELLED: 'Cancelled',
};

/** Turns an API status code (e.g. 'ISSUED') into the label shown to users ('Issued'). */
@Pipe({ name: 'invoiceStatusLabel' })
export class InvoiceStatusLabelPipe implements PipeTransform {
  transform(status: InvoiceStatus | null | undefined): string {
    return status ? LABELS[status] : '';
  }
}

/** CSS classes that colour a status chip (see .status-chip in styles.css). The chip's label
 *  always names the status too, so colour is never the only cue. */
export function invoiceStatusClass(status: InvoiceStatus): string {
  return `status-chip status-${status.toLowerCase()}`;
}
