import { Pipe, PipeTransform } from '@angular/core';

export type ContractExpiryStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';

const LABELS: Record<ContractExpiryStatus, string> = {
  ACTIVE: 'Active',
  EXPIRING_SOON: 'Expiring Soon',
  EXPIRED: 'Expired',
};

/** Turns an API contract-expiry status (e.g. 'EXPIRING_SOON') into the label shown to users. */
@Pipe({ name: 'contractStatusLabel' })
export class ContractStatusLabelPipe implements PipeTransform {
  transform(status: ContractExpiryStatus | null | undefined): string {
    return status ? LABELS[status] : '';
  }
}

/** CSS classes that colour a status chip (see .status-chip in styles.css). The chip's label
 *  always names the status too, so colour is never the only cue. */
export function contractStatusClass(status: ContractExpiryStatus): string {
  return `status-chip status-${status.toLowerCase().replace('_', '-')}`;
}
