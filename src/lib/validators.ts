import {
  CreatePartyDTO,
  UpdatePartyDTO,
  CreateProductDTO,
  CreateTransactionDTO,
  CreatePaymentDTO,
  CreateProductionEntryDTO,
  CreateExpenseDTO,
} from "@/types/dto";

type ValidationResult = { valid: true } | { valid: false; errors: Record<string, string> };

// ── Helpers ──────────────────────────────────────────────────

function isPositiveNumber(val: unknown): boolean {
  return typeof val === "number" && isFinite(val) && val >= 0;
}

function isFiniteNumber(val: unknown): boolean {
  return typeof val === "number" && isFinite(val);
}

function isObjectId(val: unknown): boolean {
  return typeof val === "string" && /^[a-f\d]{24}$/i.test(val);
}

const PARTY_CATEGORIES = ["supplier", "customer", "both"] as const;
const PRODUCT_UNITS = ["kg", "quintal"] as const;
const TRANSACTION_TYPES = ["purchase", "sale"] as const;
const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "upi", "other"] as const;

// ── Party ────────────────────────────────────────────────────

export function validateCreateParty(body: Partial<CreatePartyDTO>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!body.name?.trim()) errors.name = "Name is required";
  if (!body.category) {
    errors.category = "Category is required";
  } else if (!(PARTY_CATEGORIES as readonly string[]).includes(body.category)) {
    errors.category = `Category must be one of: ${PARTY_CATEGORIES.join(", ")}`;
  }
  if (body.openingBalance !== undefined && !isFiniteNumber(body.openingBalance)) {
    errors.openingBalance =
      "Opening balance must be a valid number (positive = to receive, negative = to pay)";
  }

  return Object.keys(errors).length ? { valid: false, errors } : { valid: true };
}

export function validateUpdateParty(body: Partial<UpdatePartyDTO>): ValidationResult {
  const errors: Record<string, string> = {};

  if (body.category && !(PARTY_CATEGORIES as readonly string[]).includes(body.category)) {
    errors.category = `Category must be one of: ${PARTY_CATEGORIES.join(", ")}`;
  }
  if (body.openingBalance !== undefined && !isFiniteNumber(body.openingBalance)) {
    errors.openingBalance =
      "Opening balance must be a valid number (positive = to receive, negative = to pay)";
  }

  return Object.keys(errors).length ? { valid: false, errors } : { valid: true };
}

// ── Product ──────────────────────────────────────────────────

export function validateCreateProduct(body: Partial<CreateProductDTO>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!body.name?.trim()) errors.name = "Product name is required";
  if (body.unit && !(PRODUCT_UNITS as readonly string[]).includes(body.unit)) {
    errors.unit = `Unit must be one of: ${PRODUCT_UNITS.join(", ")}`;
  }
  if (body.currentStock !== undefined && !isPositiveNumber(body.currentStock)) {
    errors.currentStock = "Current stock must be a non-negative number";
  }

  return Object.keys(errors).length ? { valid: false, errors } : { valid: true };
}

// ── Transaction ──────────────────────────────────────────────

export function validateCreateTransaction(body: Partial<CreateTransactionDTO>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!body.type) {
    errors.type = "Transaction type is required";
  } else if (!(TRANSACTION_TYPES as readonly string[]).includes(body.type)) {
    errors.type = `Type must be "purchase" or "sale"`;
  }
  if (!body.partyId) {
    errors.partyId = "Party ID is required";
  } else if (!isObjectId(body.partyId)) {
    errors.partyId = "Party ID must be a valid ObjectId";
  }
  if (!body.productId) {
    errors.productId = "Product ID is required";
  } else if (!isObjectId(body.productId)) {
    errors.productId = "Product ID must be a valid ObjectId";
  }
  if (body.quantity === undefined || body.quantity === null) {
    errors.quantity = "Quantity is required";
  } else if (typeof body.quantity !== "number" || body.quantity <= 0) {
    errors.quantity = "Quantity must be a positive number";
  }
  if (body.ratePerKg === undefined || body.ratePerKg === null) {
    errors.ratePerKg = "Rate per KG is required";
  } else if (typeof body.ratePerKg !== "number" || body.ratePerKg <= 0) {
    errors.ratePerKg = "Rate per KG must be a positive number";
  }
  if (body.paidAmount !== undefined && !isPositiveNumber(body.paidAmount)) {
    errors.paidAmount = "Paid amount must be a non-negative number";
  }

  return Object.keys(errors).length ? { valid: false, errors } : { valid: true };
}

// ── Payment ──────────────────────────────────────────────────

export function validateCreatePayment(body: Partial<CreatePaymentDTO>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!body.partyId) {
    errors.partyId = "Party ID is required";
  } else if (!isObjectId(body.partyId)) {
    errors.partyId = "Party ID must be a valid ObjectId";
  }
  if (body.transactionId !== undefined && !isObjectId(body.transactionId)) {
    errors.transactionId = "Transaction ID must be a valid ObjectId";
  }
  if (body.amount === undefined || body.amount === null) {
    errors.amount = "Amount is required";
  } else if (typeof body.amount !== "number" || body.amount <= 0) {
    errors.amount = "Amount must be a positive number";
  }
  if (body.direction && !["payin", "payout"].includes(body.direction)) {
    errors.direction = "Direction must be either payin or payout";
  }
  if (body.method && !(PAYMENT_METHODS as readonly string[]).includes(body.method)) {
    errors.method = `Method must be one of: ${PAYMENT_METHODS.join(", ")}`;
  }

  return Object.keys(errors).length ? { valid: false, errors } : { valid: true };
}

// ── Production Entry ─────────────────────────────────────────

export function validateCreateProductionEntry(
  body: Partial<CreateProductionEntryDTO>
): ValidationResult {
  const errors: Record<string, string> = {};

  if (!body.inputProductId) {
    errors.inputProductId = "Input product ID is required";
  } else if (!isObjectId(body.inputProductId)) {
    errors.inputProductId = "Input product ID must be a valid ObjectId";
  }
  if (!body.outputProductId) {
    errors.outputProductId = "Output product ID is required";
  } else if (!isObjectId(body.outputProductId)) {
    errors.outputProductId = "Output product ID must be a valid ObjectId";
  }
  if (body.inputQuantity === undefined || body.inputQuantity === null) {
    errors.inputQuantity = "Input quantity is required";
  } else if (typeof body.inputQuantity !== "number" || body.inputQuantity <= 0) {
    errors.inputQuantity = "Input quantity must be a positive number";
  }
  if (body.outputQuantity === undefined || body.outputQuantity === null) {
    errors.outputQuantity = "Output quantity is required";
  } else if (typeof body.outputQuantity !== "number" || body.outputQuantity <= 0) {
    errors.outputQuantity = "Output quantity must be a positive number";
  }
  if (
    body.inputQuantity &&
    body.outputQuantity &&
    body.outputQuantity > body.inputQuantity
  ) {
    errors.outputQuantity = "Output quantity cannot exceed input quantity";
  }

  return Object.keys(errors).length ? { valid: false, errors } : { valid: true };
}

// ── Expense ───────────────────────────────────────────────────

export function validateCreateExpense(body: Partial<CreateExpenseDTO>): ValidationResult {
  const errors: Record<string, string> = {};

  if (body.amount === undefined || body.amount === null) {
    errors.amount = "Amount is required";
  } else if (typeof body.amount !== "number" || body.amount <= 0) {
    errors.amount = "Amount must be a positive number";
  }
  if (!body.description?.trim()) {
    errors.description = "Description is required";
  }

  return Object.keys(errors).length ? { valid: false, errors } : { valid: true };
}