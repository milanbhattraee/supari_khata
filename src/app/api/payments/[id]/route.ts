import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Payment from "@/models/payment.model";
import {
  successResponse,
  notFoundResponse,
  handleApiError,
  badRequestResponse,
} from "@/lib/apiResponse";
import { UpdatePaymentDTO, PaymentResponseDTO } from "@/types/dto";
import mongoose from "mongoose";

type RouteContext = { params: Promise<{ id: string }> };

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

// ── GET /api/payments/:id ─────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await dbConnect();
    const { id } = await params;
    const payment = await Payment.findById(id)
      .populate("partyId", "name")
      .lean();
    if (!payment) return notFoundResponse("Payment");
    return successResponse(
      toPaymentDTO(payment as Record<string, unknown>),
      "Payment fetched"
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// ── PUT /api/payments/:id ─────────────────────────────────────
// Only metadata (method, date, reference, notes) is editable.
// Amount & party are immutable after recording.

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    await dbConnect();
    const { id } = await params;

    const body: Partial<UpdatePaymentDTO> = await req.json();

    if ("amount" in body || "partyId" in body) {
      return badRequestResponse(
        "Amount and Party cannot be modified. Delete and re-create if correction is needed."
      );
    }

    const updateFields: Record<string, unknown> = {};
    if (body.method !== undefined) updateFields.method = body.method;
    if (body.date !== undefined) updateFields.date = new Date(body.date);
    if (body.referenceNumber !== undefined)
      updateFields.referenceNumber = body.referenceNumber;
    if (body.notes !== undefined) updateFields.notes = body.notes;

    const payment = await Payment.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .populate("partyId", "name")
      .lean();

    if (!payment) return notFoundResponse("Payment");

    return successResponse(
      toPaymentDTO(payment as Record<string, unknown>),
      "Payment updated"
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// ── DELETE /api/payments/:id ──────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await dbConnect();
    const { id } = await params;
    const payment = await Payment.findByIdAndDelete(id);
    if (!payment) return notFoundResponse("Payment");
    return successResponse(null, "Payment deleted successfully");
  } catch (err) {
    return handleApiError(err);
  }
}