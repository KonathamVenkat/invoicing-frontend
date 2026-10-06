export interface Product {
  id?: number;
  code?: string;
  name: string;
  nameAr?: string;
  description?: string;
  unit: string;
  defaultPrice: number;
  defaultVatPct: number;
  active: boolean;
  customerId?: number | null;
  customerName?: string;
}
