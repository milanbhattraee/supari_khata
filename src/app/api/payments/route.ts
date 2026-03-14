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
import { CreatePaymentDTO, PaymentQueryDTO } from "@/types/dto";
import mongoose from "mongoose";
import {
  centsToMoneyString,
  toMoneyCents,
} from "@/lib/financial";
import { toPaymentDTO } from "@/lib/dto-mappers";
import { requireApiAuth } from "@/lib/api-auth";
import { buildUtcDateRange } from "@/lib/nepal-date-range";

type RouteValidationFailure = {
  type: "validation";
  errors: Record<string, string>;
};

function routeValidationFailure(errors: Record<string, string>): RouteValidationFailure {
  return { type: "validation", errors };
}

function isRouteValidationFailure(error: unknown): error is RouteValidationFailure {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: unknown }).type === "validation" &&
    "errors" in error
  );
}

// ── GET /api/payments ─────────────────────────────────────────
// Query: partyId, method, fromDate, toDate, page, limit

export async function GET(req: NextRequest) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    const { searchParams } = req.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);
    const query = Object.fromEntries(searchParams.entries()) as PaymentQueryDTO;

    const filter: Record<string, unknown> = {};
    if (query.partyId) filter.partyId = new mongoose.Types.ObjectId(query.partyId);
    if (query.method) filter.method = query.method;
    const dateRange = buildUtcDateRange(query.fromDate, query.toDate);
    if (dateRange) filter.date = dateRange;

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
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

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

    const amountCents = toMoneyCents(Number(body.amount));
    const basePaymentData = {
      partyId: body.partyId,
      amount: mongoose.Types.Decimal128.fromString(centsToMoneyString(amountCents)),
      method: body.method ?? "cash",
      date: body.date ? new Date(body.date) : new Date(),
      referenceNumber: body.referenceNumber?.trim(),
      notes: body.notes?.trim(),
    };

    let paymentId: mongoose.Types.ObjectId | undefined;

    if (body.transactionId) {
      const Transaction = (await import("@/models/transaction.model")).default;
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const transaction = await Transaction.findById(body.transactionId, null, {
            session,
          });
          if (!transaction) {
            throw routeValidationFailure({ transactionId: "Transaction not found" });
          }
          if (transaction.partyId.toString() !== String(body.partyId)) {
            throw routeValidationFailure({
              transactionId: "Transaction does not belong to selected party",
            });
          }

          const direction =
            body.direction ?? (transaction.type === "purchase" ? "payout" : "payin");
          const expectedDirection =
            transaction.type === "purchase" ? "payout" : "payin";
          if (direction !== expectedDirection) {
            throw routeValidationFailure({
              direction:
                expectedDirection === "payout"
                  ? "Purchase settlement requires payout"
                  : "Sale settlement requires pay in",
            });
          }

          const txnTotal = parseFloat(transaction.totalAmount.toString());
          const txnPaid = parseFloat(transaction.paidAmount.toString());
          const txnTotalCents = toMoneyCents(txnTotal);
          const txnPaidCents = toMoneyCents(txnPaid);
          const remainingCents = txnTotalCents - txnPaidCents;

          if (remainingCents <= 0) {
            throw routeValidationFailure({
              amount: "Transaction is already fully settled. Record a standalone payment instead.",
            });
          }

          if (amountCents > remainingCents) {
            // -- SPLIT OVERPAYMENT LOGIC --
            // 1. Fully settle this transaction
            transaction.paidAmount = mongoose.Types.Decimal128.fromString(
              centsToMoneyString(txnTotalCents)
            );
            await transaction.save({ validateBeforeSave: false, session });

            // 2. Save the linked payment for the exact remaining amount
            const linkedPayment = new Payment({
              ...basePaymentData,
              amount: mongoose.Types.Decimal128.fromString(
                centsToMoneyString(remainingCents)
              ),
              transactionId: transaction._id,
              direction,
            });
            await linkedPayment.save({ session });

            // 3. Save the excess as an Advance (Standalone Payment)
            const excessCents = amountCents - remainingCents;
            const standalonePayment = new Payment({
              ...basePaymentData,
              amount: mongoose.Types.Decimal128.fromString(
                centsToMoneyString(excessCents)
              ),
              direction,
              notes: `${basePaymentData.notes || ""} (Overpayment from Txn ${transaction._id.toString().slice(-6)})`.trim(),
            });
            await standalonePayment.save({ session });

            paymentId = standalonePayment._id as mongoose.Types.ObjectId;
          } else {
            // -- NORMAL EXACT OR PARTIAL PAYMENT --
            const nextPaidCents = txnPaidCents + amountCents;
            transaction.paidAmount = mongoose.Types.Decimal128.fromString(
              centsToMoneyString(nextPaidCents)
            );
            await transaction.save({ validateBeforeSave: false, session });

            const payment = new Payment({
              ...basePaymentData,
              transactionId: transaction._id,
              direction,
            });
            await payment.save({ session });
            paymentId = payment._id as mongoose.Types.ObjectId;
          }
        });
      } catch (error) {
        if (isRouteValidationFailure(error)) {
          return validationErrorResponse(error.errors);
        }
        throw error;
      } finally {
        await session.endSession();
      }
    } else {
      const payment = await Payment.create({
        ...basePaymentData,
        direction:
          body.direction ?? (party.category === "supplier" ? "payout" : "payin"),
      });
      paymentId = payment._id as mongoose.Types.ObjectId;
    }

    if (!paymentId) {
      throw new Error("Payment record not created");
    }

    const populated = await Payment.findById(paymentId)
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