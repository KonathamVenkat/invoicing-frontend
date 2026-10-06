export interface Contract {
  id?: number;
  customerId: number;
  customerName?: string;
  productId: number;
  productName?: string;
  contractCode: string;
  startDate: string; // ISO yyyy-MM-dd
  endDate: string; // ISO yyyy-MM-dd
  notes?: string;
}
