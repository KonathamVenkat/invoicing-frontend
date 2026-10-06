export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'ONLINE';

export interface Payment {
  id?: number;
  invoiceId: number;
  invoiceNumber?: string;
  paymentDate: string; // ISO yyyy-MM-dd
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNote?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD', 'ONLINE'];

/** One invoice's total paid-to-date — see PaymentService.getTotals(). */
export interface PaymentTotal {
  invoiceId: number;
  totalPaid: number;
}
