import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Payment from "@/models/payment.model";
import {
  successResponse,
  createdResponse,
  handleApiError,
  validationErrorResponse,
  parsePagination,
  buildMeta,
} from "@/lib/apiResponse";
import { validateCreatePayment } from "@/lib/validators";
import { CreatePaymentDTO, PaymentResponseDTO, PaymentQueryDTO } from "@/types/dto";
import mongoose from "mongoose";

function toPaymentDTO(p: Record<string, unknown>): PaymentResponseDTO {
  const party = p.partyId as Record<string, unknown>;
  return {
    _id: (p._id as { toString(): string }).toString(),
    party: {
      _id: (party._id as { toString(): string }).toString(),
      name: party.name as string,
    },
    amount: parseFloat((p.amount as mongoose.Types.Decimal128).toString()),
    method: p.method as PaymentResponseDTO["method"],
    date: (p.date as Date).toISOString(),
    referenceNumber: (p.referenceNumber as string) ?? null,
    notes: (p.notes as string) ?? null,
    createdAt: (p.createdAt as Date).toISOString(),
    updatedAt: (p.updatedAt as Date).toISOString(),
  };
}

// ── GET /api/payments ─────────────────────────────────────────
// Query: partyId, method, fromDate, toDate, page, limit

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = req.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);
    const query = Object.fromEntries(searchParams.entries()) as PaymentQueryDTO;

    const filter: Record<string, unknown> = {};
    if (query.partyId) filter.partyId = new mongoose.Types.ObjectId(query.partyId);
    if (query.method) filter.method = query.method;
    if (query.fromDate || query.toDate) {
      filter.date = {
        ...(query.fromDate && { $gte: new Date(query.fromDate) }),
        ...(query.toDate && { $lte: new Date(query.toDate) }),
      };
    }

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate("partyId", "name")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(filter),
    ]);

    return successResponse(
      payments.map((p) => toPaymentDTO(p as Record<string, unknown>)),
      "Payments fetched",
      200,
      buildMeta(total, page, limit)
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// ── POST /api/payments ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body: Partial<CreatePaymentDTO> = await req.json();

    const validation = validateCreatePayment(body);
    if (!validation.valid) return validationErrorResponse(validation.errors);

    // Verify party exists
    const Party = (await import("@/models/parties.model")).default;
    const party = await Party.findById(body.partyId);
    if (!party) {
      return validationErrorResponse({ partyId: "Party not found" });
    }

    const payment = await Payment.create({
      partyId: body.partyId,
      amount: mongoose.Types.Decimal128.fromString(String(body.amount)),
      method: body.method ?? "cash",
      date: body.date ? new Date(body.date) : new Date(),
      referenceNumber: body.referenceNumber?.trim(),
      notes: body.notes?.trim(),
    });

    const populated = await Payment.findById(payment._id)
      .populate("partyId", "name")
      .lean();

    return createdResponse(
      toPaymentDTO(populated as Record<string, unknown>),
      "Payment recorded successfully"
    );
  } catch (err) {
    return handleApiError(err);
  }
}