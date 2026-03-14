import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Payment from "@/models/payment.model";
import {
  successResponse,
  notFoundResponse,
  handleApiError,
  badRequestResponse,
} from "@/lib/apiResponse";
import { UpdatePaymentDTO } from "@/types/dto";
import mongoose from "mongoose";
import { centsToMoneyString, toMoneyCents } from "@/lib/financial";
import { toPaymentDTO } from "@/lib/dto-mappers";
import { requireApiAuth } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/payments/:id ─────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

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
// Only metadata (direction, method, date, reference, notes) is editable.
// Amount & party are immutable after recording.

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;

    const body: Partial<UpdatePaymentDTO> = await req.json();

    const existingPayment = await Payment.findById(id);
    if (!existingPayment) return notFoundResponse("Payment");

    if ("amount" in body || "partyId" in body) {
      return badRequestResponse(
        "Amount and Party cannot be modified. Delete and re-create if correction is needed."
      );
    }

    // Linked transaction settlements must keep their original direction for math integrity.
    if (
      existingPayment.transactionId &&
      body.direction !== undefined &&
      body.direction !== existingPayment.direction
    ) {
      return badRequestResponse(
        "Direction cannot be changed for a payment linked to a transaction."
      );
    }

    const updateFields: Record<string, unknown> = {};
    if (body.direction !== undefined) updateFields.direction = body.direction;
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
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;
    const Transaction = (await import("@/models/transaction.model")).default;
    const session = await mongoose.startSession();
    let foundPayment = true;

    try {
      await session.withTransaction(async () => {
        const payment = await Payment.findById(id, null, { session });
        if (!payment) {
          foundPayment = false;
          return;
        }

        if (payment.transactionId) {
          const transaction = await Transaction.findById(payment.transactionId, null, {
            session,
          });

          if (transaction) {
            const paymentAmount = parseFloat(payment.amount.toString());
            const txnPaid = parseFloat(transaction.paidAmount.toString());
            const paymentAmountCents = toMoneyCents(paymentAmount);
            const txnPaidCents = toMoneyCents(txnPaid);
            const nextPaidCents = Math.max(0, txnPaidCents - paymentAmountCents);

            transaction.paidAmount = mongoose.Types.Decimal128.fromString(
              centsToMoneyString(nextPaidCents)
            );
            await transaction.save({ validateBeforeSave: false, session });
          }
        }

        await Payment.deleteOne({ _id: id }, { session });
      });
    } finally {
      await session.endSession();
    }

    if (!foundPayment) return notFoundResponse("Payment");

    return successResponse(null, "Payment deleted successfully");
  } catch (err) {
    return handleApiError(err);
  }
}