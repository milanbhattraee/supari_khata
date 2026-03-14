import mongoose from "mongoose";
import {
  PartyCategory,
  PartyResponseDTO,
  PaymentResponseDTO,
  ProductResponseDTO,
  ProductionEntryResponseDTO,
  TransactionResponseDTO,
} from "@/types/dto";

function asDecimal(value: unknown): mongoose.Types.Decimal128 | null {
  return value instanceof mongoose.Types.Decimal128 ? value : null;
}

export function toPartyDTO(p: Record<string, unknown>): PartyResponseDTO {
  return {
    _id: (p._id as { toString(): string }).toString(),
    name: p.name as string,
    phone: (p.phone as string) ?? null,
    address: (p.address as string) ?? null,
    category: p.category as PartyCategory,
    openingBalance: parseFloat(
      asDecimal(p.openingBalance)?.toString() ?? String(p.openingBalance ?? "0")
    ),
    isActive: Boolean(p.isActive),
    createdAt: (p.createdAt as Date).toISOString(),
    updatedAt: (p.updatedAt as Date).toISOString(),
  };
}

export function toProductDTO(p: Record<string, unknown>): ProductResponseDTO {
  return {
    _id: (p._id as { toString(): string }).toString(),
    name: p.name as string,
    unit: p.unit as ProductResponseDTO["unit"],
    currentStock: parseFloat(
      asDecimal(p.currentStock)?.toString() ?? String(p.currentStock ?? "0")
    ),
    description: (p.description as string) ?? null,
    isActive: Boolean(p.isActive),
    createdAt: (p.createdAt as Date).toISOString(),
    updatedAt: (p.updatedAt as Date).toISOString(),
  };
}

export function toProductionDTO(
  e: Record<string, unknown>
): ProductionEntryResponseDTO {
  const input = e.inputProductId as Record<string, unknown>;
  const output = e.outputProductId as Record<string, unknown>;
  const inQty = parseFloat(asDecimal(e.inputQuantity)?.toString() ?? "0");
  const outQty = parseFloat(asDecimal(e.outputQuantity)?.toString() ?? "0");

  return {
    _id: (e._id as { toString(): string }).toString(),
    inputProduct: {
      _id: (input._id as { toString(): string }).toString(),
      name: input.name as string,
      unit: input.unit as ProductionEntryResponseDTO["inputProduct"]["unit"],
    },
    inputQuantity: inQty,
    outputProduct: {
      _id: (output._id as { toString(): string }).toString(),
      name: output.name as string,
      unit: output.unit as ProductionEntryResponseDTO["outputProduct"]["unit"],
    },
    outputQuantity: outQty,
    yieldLoss: parseFloat((inQty - outQty).toFixed(3)),
    date: (e.date as Date).toISOString(),
    notes: (e.notes as string) ?? null,
    createdAt: (e.createdAt as Date).toISOString(),
    updatedAt: (e.updatedAt as Date).toISOString(),
  };
}

export function toTransactionDTO(
  t: Record<string, unknown>
): TransactionResponseDTO {
  const party = t.partyId as Record<string, unknown>;
  const product = t.productId as Record<string, unknown>;

  return {
    _id: (t._id as { toString(): string }).toString(),
    type: t.type as TransactionResponseDTO["type"],
    party: {
      _id: (party._id as { toString(): string }).toString(),
      name: party.name as string,
      category: party.category as TransactionResponseDTO["party"]["category"],
    },
    product: {
      _id: (product._id as { toString(): string }).toString(),
      name: product.name as string,
      unit: product.unit as TransactionResponseDTO["product"]["unit"],
    },
    quantity: parseFloat(asDecimal(t.quantity)?.toString() ?? "0"),
    ratePerKg: parseFloat(asDecimal(t.ratePerKg)?.toString() ?? "0"),
    totalAmount: parseFloat(asDecimal(t.totalAmount)?.toString() ?? "0"),
    paidAmount: parseFloat(asDecimal(t.paidAmount)?.toString() ?? "0"),
    balanceAmount: parseFloat(asDecimal(t.balanceAmount)?.toString() ?? "0"),
    date: (t.date as Date).toISOString(),
    notes: (t.notes as string) ?? null,
    createdAt: (t.createdAt as Date).toISOString(),
    updatedAt: (t.updatedAt as Date).toISOString(),
  };
}

export function toPaymentDTO(p: Record<string, unknown>): PaymentResponseDTO {
  const party = p.partyId as Record<string, unknown>;
  return {
    _id: (p._id as { toString(): string }).toString(),
    party: {
      _id: (party._id as { toString(): string }).toString(),
      name: party.name as string,
    },
    transactionId: p.transactionId
      ? (p.transactionId as { toString(): string }).toString()
      : null,
    amount: parseFloat(asDecimal(p.amount)?.toString() ?? "0"),
    direction: (p.direction as PaymentResponseDTO["direction"]) ?? "payin",
    method: p.method as PaymentResponseDTO["method"],
    date: (p.date as Date).toISOString(),
    referenceNumber: (p.referenceNumber as string) ?? null,
    notes: (p.notes as string) ?? null,
    createdAt: (p.createdAt as Date).toISOString(),
    updatedAt: (p.updatedAt as Date).toISOString(),
  };
}
