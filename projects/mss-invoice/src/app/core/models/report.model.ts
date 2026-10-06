/** One customer's row of the AR Aging report — see ReportService.getArAging(). Field names
 *  match the backend ArAgingRowDto exactly. */
export interface ArAgingRow {
  customerId: number;
  customerCode?: string;
  customerName: string;
  current: number;
  days1To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  total: number;
}

/** One period's (month/quarter/total) VAT totals — see the backend VatPeriodTotalsDto. */
export interface VatPeriodTotals {
  label: string;
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
}

/** VAT summary for one calendar year — see ReportService.getVatSummary(). Field names match
 *  the backend VatSummaryDto exactly. */
export interface VatSummary {
  year: number;
  months: VatPeriodTotals[];
  quarters: VatPeriodTotals[];
  total: VatPeriodTotals;
}

/** One ledger line (an issued invoice or a payment) of a customer statement. */
export interface StatementLine {
  date: string; // ISO yyyy-MM-dd
  type: 'INVOICE' | 'PAYMENT';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

/** A customer's statement over an optional date range — see ReportService.getCustomerStatement().
 *  Field names match the backend CustomerStatementDto exactly. */
export interface CustomerStatement {
  customerId: number;
  customerCode?: string;
  customerName: string;
  from?: string;
  to?: string;
  openingBalance: number;
  lines: StatementLine[];
  closingBalance: number;
}

/** One product's revenue row for a year — see ReportService.getProductRevenue(). Field names
 *  match the backend ProductRevenueRowDto exactly. */
export interface ProductRevenueRow {
  productId: number;
  productCode?: string;
  productName: string;
  quantity: number;
  revenue: number;
  vatAmount: number;
  total: number;
  percentOfTotal: number;
}

/** One (customer, product) pair's latest contract, classified for the expiry report — see
 *  ReportService.getContractExpiry(). Field names match the backend ContractExpiryRowDto exactly. */
export interface ContractExpiryRow {
  contractId: number;
  contractCode: string;
  customerName: string;
  productName: string;
  startDate: string; // ISO yyyy-MM-dd
  endDate: string; // ISO yyyy-MM-dd
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';
}

/** One invoice row of the invoice register — see ReportService.getInvoiceRegister(). Field
 *  names match the backend InvoiceRegisterRowDto exactly. */
export interface InvoiceRegisterRow {
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string; // ISO yyyy-MM-dd
  dueDate?: string; // ISO yyyy-MM-dd
  customerName: string;
  subtotal: number;
  vatAmount: number;
  grandTotal: number;
}

/** The invoice register over an optional date range — see ReportService.getInvoiceRegister().
 *  Field names match the backend InvoiceRegisterDto exactly. */
export interface InvoiceRegister {
  from?: string;
  to?: string;
  lines: InvoiceRegisterRow[];
  totalSubtotal: number;
  totalVat: number;
  totalGrand: number;
}
