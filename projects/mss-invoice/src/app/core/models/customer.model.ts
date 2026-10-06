export type CustomerType = 'INDIVIDUAL' | 'COMPANY' | 'GOVERNMENT';

export interface Customer {
  id?: number;
  customerCode?: string;
  name: string;
  nameAr?: string;
  customerType: CustomerType;
  addressLine?: string;
  poBox?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  vatNumber?: string;
  active: boolean;
}
