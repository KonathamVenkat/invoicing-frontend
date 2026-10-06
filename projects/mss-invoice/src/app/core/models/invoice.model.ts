export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

export interface InvoiceLine {
  id?: number;
  lineNo?: number;
  productId?: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  vatPct: number;
  lineSubtotal?: number;
  lineVatAmount?: number;
  lineTotal?: number;
}

export interface Invoice {
  id?: number;
  invoiceNumber?: string;
  invoiceDate: string; // ISO yyyy-MM-dd
  dueDate?: string | null;
  companyId: number;
  customerId: number;
  /** Read-only: derived server-side from the customer/product's active Contract. Any value
   *  set here before saving is ignored by the backend — see contract.service.ts. */
  contractNumber?: string;
  contractDate?: string | null;
  /** Read-only, for reporting — the Contract this invoice was billed under, if any. */
  contractId?: number | null;
  referenceNote?: string;
  currencyCode?: string;
  subtotal?: number;
  vatAmount?: number;
  grandTotal?: number;
  status?: InvoiceStatus;
  notes?: string;
  lines: InvoiceLine[];
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceRevisionLine {
  lineNo: number;
  productId?: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  vatPct: number;
  lineSubtotal: number;
  lineVatAmount: number;
  lineTotal: number;
}

export interface InvoiceRevision {
  invoiceRevisionId: number;
  revisionNumber: number;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  contractNumber?: string;
  referenceNote?: string;
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
  status: InvoiceStatus;
  notes?: string;
  changeReason: string;
  changedByUserId: number;
  changedByUsername: string;
  changedAt: string;
  lines: InvoiceRevisionLine[];
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
