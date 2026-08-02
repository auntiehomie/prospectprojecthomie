export interface Prospect {
  'Business Name': string;
  Address: string;
  City: string;
  State: string;
  'Zip Code': string;
  'PPP Lender': string;
  'Total PPP Loan Amount': string;
  'Total Forgiveness Amount': string;
  'NAICS Code': string;
  'Nearest Closing Branch': string;
  'Nearest Branch Address': string;
  'Distance to Closing Branch (mi)': string;
  Phone: string;
  Email: string;
  'Contact Source': string;
  'Contact Note': string;
}

export type FilterState = {
  search: string;
  zipCodes: string[];
  branches: string[];
  minLoan: number | null;
  maxLoan: number | null;
  maxDistance: number | null;
  naicsCodes: string[];
  hasPhone: boolean;
  hasEmail: boolean;
  onlyVerified: boolean;
};

export type SortConfig = {
  key: keyof Prospect;
  direction: 'asc' | 'desc';
};