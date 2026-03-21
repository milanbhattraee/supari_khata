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

// ── GET /api/payments ─────────────────────────────────────────
// Query: partyId, direction, method, fromDate, toDate, search, page, limit

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
    if (query.direction && (query.direction === "payin" || query.direction === "payout")) {
      filter.direction = query.direction;
    }
    if (query.method) filter.method = query.method;
    const dateRange = buildUtcDateRange(query.fromDate, query.toDate);
    if (dateRange) filter.date = dateRange;

    // Handle search - search by party name
    if (query.search) {
      const searchRegex = new RegExp(query.search, "i");

      // Find matching party IDs
      const Party = (await import("@/models/parties.model")).default;
      const matchingParties = await Party.find({ name: searchRegex }).select("_id").lean();
      const partyIds = matchingParties.map((p) => p._id);

      if (partyIds.length > 0) {
        filter.partyId = { $in: partyIds };
      } else {
        // No matches found, return empty result
        return successResponse([], "Payments fetched", 200, buildMeta(0, page, limit));
      }
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
    let splitInfo: {
      wasOverpayment: boolean;
      linkedPaymentId: string;
      linkedAmount: number;
      advancePaymentId: string;
      advanceAmount: number;
      totalPaid: number;
    } | undefined;

    if (body.transactionId) {
      const Transaction = (await import("@/models/transaction.model")).default;
      const transaction = await Transaction.findById(body.transactionId);

      if (!transaction) {
        return validationErrorResponse({ transactionId: "Transaction not found" });
      }
      if (transaction.partyId.toString() !== String(body.partyId)) {
        return validationErrorResponse({
          transactionId: "Transaction does not belong to selected party",
        });
      }

      const direction =
        body.direction ?? (transaction.type === "purchase" ? "payout" : "payin");
      const expectedDirection =
        transaction.type === "purchase" ? "payout" : "payin";
      if (direction !== expectedDirection) {
        return validationErrorResponse({
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
        return validationErrorResponse({
          amount: "Transaction is already fully settled. Record a standalone payment instead.",
        });
      }

      if (amountCents > remainingCents) {
        // -- SPLIT OVERPAYMENT LOGIC --
        const excessCents = amountCents - remainingCents;

        // 1. Fully settle this transaction
        transaction.paidAmount = mongoose.Types.Decimal128.fromString(
          centsToMoneyString(txnTotalCents)
        );
        await transaction.save({ validateBeforeSave: false });

        // 2. Save the linked payment for the exact remaining amount
        const linkedPayment = new Payment({
          ...basePaymentData,
          amount: mongoose.Types.Decimal128.fromString(
            centsToMoneyString(remainingCents)
          ),
          transactionId: transaction._id,
          direction,
        });
        await linkedPayment.save();

        // 3. Save the excess as an Advance (Standalone Payment)
        const standalonePayment = new Payment({
          ...basePaymentData,
          amount: mongoose.Types.Decimal128.fromString(
            centsToMoneyString(excessCents)
          ),
          direction,
          notes: `${basePaymentData.notes || ""} (Advance from Txn ${transaction._id.toString().slice(-6)})`.trim(),
        });
        await standalonePayment.save();

        paymentId = linkedPayment._id as mongoose.Types.ObjectId;
        splitInfo = {
          wasOverpayment: true,
          linkedPaymentId: (linkedPayment._id as mongoose.Types.ObjectId).toString(),
          linkedAmount: parseFloat(centsToMoneyString(remainingCents)),
          advancePaymentId: (standalonePayment._id as mongoose.Types.ObjectId).toString(),
          advanceAmount: parseFloat(centsToMoneyString(excessCents)),
          totalPaid: parseFloat(centsToMoneyString(amountCents)),
        };
      } else {
        // -- NORMAL EXACT OR PARTIAL PAYMENT --
        const nextPaidCents = txnPaidCents + amountCents;
        transaction.paidAmount = mongoose.Types.Decimal128.fromString(
          centsToMoneyString(nextPaidCents)
        );
        await transaction.save({ validateBeforeSave: false });

        const payment = new Payment({
          ...basePaymentData,
          transactionId: transaction._id,
          direction,
        });
        await payment.save();
        paymentId = payment._id as mongoose.Types.ObjectId;
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

    const paymentData = toPaymentDTO(populated as Record<string, unknown>);

    // If this was an overpayment split, include the split details
    if (splitInfo) {
      return createdResponse(
        { ...paymentData, splitInfo },
        `Payment recorded. Rs. ${splitInfo.linkedAmount} settled the transaction, Rs. ${splitInfo.advanceAmount} recorded as advance.`
      );
    }

    return createdResponse(paymentData, "Payment recorded successfully");
  } catch (err) {
    return handleApiError(err);
  }
}