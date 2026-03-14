// ============================================================
//  ENUMS (union types for Zod compatibility)
// ============================================================

export type PartyCategory = "supplier" | "customer" | "both";

export type TransactionType = "purchase" | "sale";

export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "upi" | "other";
export type PaymentDirection = "payin" | "payout";

export type ProductUnit = "kg" | "quintal";

// ============================================================
//  SHARED / BASE TYPES
// ============================================================

/** Standard API envelope wrapping every response */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ============================================================
//  PARTY DTOs
// ============================================================

/** POST /api/parties  — request body */
export interface CreatePartyDTO {
  name: string;                        // required
  phone?: string;
  address?: string;
  category: PartyCategory;             // required
  openingBalance?: number;             // default 0
}

/** PUT /api/parties/:id  — request body (all optional for partial update) */
export interface UpdatePartyDTO {
  name?: string;
  phone?: string;
  address?: string;
  category?: PartyCategory;
  openingBalance?: number;
  isActive?: boolean;
}

/** Shape returned to the client for a single Party */
export interface PartyResponseDTO {
  _id: string;
  name: string;
  phone: string | null;
  address: string | null;
  category: PartyCategory;
  openingBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/parties/:id/balance — response data */
export interface PartyBalanceResponseDTO {
  partyId: string;
  partyName: string;
  openingBalance: number;
  totalSalesDue: number;           // what customer owes you (from sales)
  totalPurchasesDue: number;       // what you owe supplier (from purchases)
  totalStandalonePayments: number; // sum of all Payment records
  /** Positive = party owes YOU | Negative = YOU owe the party */
  outstandingBalance: number;
  direction: "to-receive" | "to-pay" | "settled";
}

// ============================================================
//  PRODUCT DTOs
// ============================================================

export interface CreateProductDTO {
  name: string;                  // required, unique
  unit?: ProductUnit;            // default "kg"
  description?: string;
  /** Optional: set initial stock (e.g., for migration) */
  currentStock?: number;
}

export interface UpdateProductDTO {
  name?: string;
  unit?: ProductUnit;
  description?: string;
  isActive?: boolean;
}

export interface ProductResponseDTO {
  _id: string;
  name: string;
  unit: ProductUnit;
  currentStock: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
//  TRANSACTION DTOs
// ============================================================

export interface CreateTransactionDTO {
  type: TransactionType;         // required — "purchase" | "sale"
  partyId: string;               // required — ObjectId string
  productId: string;             // required — ObjectId string
  quantity: number;              // required — in KG
  ratePerKg: number;             // required — market rate at this moment
  /** Amount paid right now. Default 0 = full credit/due */
  paidAmount?: number;
  date?: string;                 // ISO date string; defaults to now
  notes?: string;
}

export interface UpdateTransactionDTO {
  /** Only non-financial meta fields are editable post-creation */
  notes?: string;
  date?: string;
  /** Allow correcting paidAmount (triggers recalculation of balance) */
  paidAmount?: number;
}

export interface TransactionResponseDTO {
  _id: string;
  type: TransactionType;
  party: {
    _id: string;
    name: string;
    category: PartyCategory;
  };
  product: {
    _id: string;
    name: string;
    unit: ProductUnit;
  };
  quantity: number;
  ratePerKg: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  date: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/transactions  — query params */
export interface TransactionQueryDTO extends PaginationQuery {
  type?: TransactionType;
  partyId?: string;
  productId?: string;
  fromDate?: string;   // ISO date
  toDate?: string;     // ISO date
}

// ============================================================
//  PAYMENT DTOs
// ============================================================

export interface CreatePaymentDTO {
  partyId: string;               // required
  amount: number;                // required — must be > 0
  transactionId?: string;        // optional — settle a specific transaction
  direction?: PaymentDirection;
  method?: PaymentMethod;        // default "cash"
  date?: string;
  referenceNumber?: string;      // cheque no / UTR / UPI ref
  notes?: string;
}

export interface UpdatePaymentDTO {
  transactionId?: string;
  direction?: PaymentDirection;
  method?: PaymentMethod;
  date?: string;
  referenceNumber?: string;
  notes?: string;
}

export interface PaymentResponseDTO {
  _id: string;
  party: {
    _id: string;
    name: string;
  };
  transactionId?: string | null;
  amount: number;
  direction: PaymentDirection;
  method: PaymentMethod;
  date: string;
  referenceNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentQueryDTO extends PaginationQuery {
  partyId?: string;
  method?: PaymentMethod;
  fromDate?: string;
  toDate?: string;
}

// ============================================================
//  PRODUCTION ENTRY DTOs
// ============================================================

export interface CreateProductionEntryDTO {
  inputProductId: string;        // required — Raw Nut product ObjectId
  inputQuantity: number;         // required — kg consumed
  outputProductId: string;       // required — Processed product ObjectId
  outputQuantity: number;        // required — kg produced
  date?: string;
  notes?: string;
}

export interface UpdateProductionEntryDTO {
  notes?: string;
  date?: string;
}

export interface ProductionEntryResponseDTO {
  _id: string;
  inputProduct: {
    _id: string;
    name: string;
    unit: ProductUnit;
  };
  inputQuantity: number;
  outputProduct: {
    _id: string;
    name: string;
    unit: ProductUnit;
  };
  outputQuantity: number;
  /** Waste/loss = inputQuantity - outputQuantity */
  yieldLoss: number;
  date: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
//  DASHBOARD / ANALYTICS DTOs
// ============================================================

export interface DashboardSummaryDTO {
  totalParties: number;
  totalProducts: number;
  totalTransactionsToday: number;
  totalPurchasesToday: number;
  totalSalesToday: number;
  totalOutstandingReceivable: number;  // money customers owe you
  totalOutstandingPayable: number;     // money you owe suppliers
  lowStockProducts: ProductResponseDTO[];
}