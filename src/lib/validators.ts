import {
  CreatePartyDTO,
  UpdatePartyDTO,
  CreateProductDTO,
  CreateTransactionDTO,
  CreatePaymentDTO,
  CreateProductionEntryDTO,
  PartyCategory,
  TransactionType,
  PaymentMethod,
  ProductUnit,
} from "@/types/dto";

type ValidationResult = { valid: true } | { valid: false; errors: Record<string, string> };

// ── Helpers ──────────────────────────────────────────────────

function isPositiveNumber(val: unknown): boolean {
  return typeof val === "number" && isFinite(val) && val >= 0;
}
function isObjectId(val: unknown): boolean {
  return typeof val === "string" && /^[a-f\d]{24}$/i.test(val);
}

// ── Party ────────────────────────────────────────────────────

export function validateCreateParty(body: Partial<CreatePartyDTO>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!body.name?.trim()) errors.name = "Name is required";
  if (!body.category) {
    errors.category = "Category is required";
  } else if (!Object.values(PartyCategory).includes(body.category)) {
    errors.category = `Category must be one of: ${Object.values(PartyCategory).join(", ")}`;
  }
  if (body.openingBalance !== undefined && !isPositiveNumber(body.openingBalance)) {
    errors.openingBalance = "Opening balance must be a non-negative number";
  }

  return Object.keys(errors).length ? { valid: false, errors } : { valid: true };
}

export function validateUpdateParty(body: Partial<UpdatePartyDTO>): ValidationResult {
  const errors: Record<string, string> = {};

  if (body.category && !Object.values(PartyCategory).includes(body.category)) {
    errors.category = `Category must be one of: ${Object.values(PartyCategory).join(", ")}`;
  }
  if (body.openingBalance !== undefined && typeof body.openingBalance !== "number") {
    errors.openingBalance = "Opening balance must be a number";
  }

  return Object.keys(errors).length ? { valid: false, errors } : { valid: true };
}

// ── Product ──────────────────────────────────────────────────

export function validateCreateProduct(body: Partial<CreateProductDTO>): ValidationResult {
  const errors: Record<string, string> = {};

  if (!body.name?.trim()) errors.name = "Product name is required";
  if (body.unit && !Object.values(ProductUnit).includes(body.unit)) {
    errors.unit = `Unit must be one of: ${Object.values(ProductUnit).join(", ")}`;
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
  } else if (!Object.values(TransactionType).includes(body.type)) {
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
  if (body.amount === undefined || body.amount === null) {
    errors.amount = "Amount is required";
  } else if (typeof body.amount !== "number" || body.amount <= 0) {
    errors.amount = "Amount must be a positive number";
  }
  if (body.method && !Object.values(PaymentMethod).includes(body.method)) {
    errors.method = `Method must be one of: ${Object.values(PaymentMethod).join(", ")}`;
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