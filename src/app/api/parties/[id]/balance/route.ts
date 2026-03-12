import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Party from "@/models/parties.model";
import { successResponse, notFoundResponse, handleApiError } from "@/lib/apiResponse";
import { PartyBalanceResponseDTO } from "@/types/dto";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/parties/:id/balance ─────────────────────────────
// Returns a full ledger summary for the party.
// Positive outstandingBalance = party owes YOU money
// Negative outstandingBalance = YOU owe the party money

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await dbConnect();
    const { id } = await params;

    const party = await Party.findById(id).lean();
    if (!party) return notFoundResponse("Party");

    // Get the dynamically calculated balance via static method on Party model
    const outstandingBalance = await Party.getOutstandingBalance(id);

    // Fetch the breakdown for transparency
    const Transaction = (await import("@/models/transaction.model")).default;
    const Payment = (await import("@/models/payment.model")).default;

    const txnResult = await Transaction.aggregate([
      {
        $match: {
          partyId: party._id,
        },
      },
      {
        $group: {
          _id: "$type",
          totalBalance: { $sum: { $toDouble: "$balanceAmount" } },
        },
      },
    ]);

    const paymentResult = await Payment.aggregate([
      {
        $match: {
          partyId: party._id,
        },
      },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);

    const openingBalance = parseFloat(party.openingBalance?.toString() ?? "0");
    const totalSalesDue = txnResult.find((t: { _id: string }) => t._id === "sale")?.totalBalance ?? 0;
    const totalPurchasesDue = txnResult.find((t: { _id: string }) => t._id === "purchase")?.totalBalance ?? 0;
    const totalStandalonePayments = paymentResult[0]?.totalPaid ?? 0;

    let direction: PartyBalanceResponseDTO["direction"];
    if (outstandingBalance > 0) direction = "to-receive";
    else if (outstandingBalance < 0) direction = "to-pay";
    else direction = "settled";

    const data: PartyBalanceResponseDTO = {
      partyId: party._id.toString(),
      partyName: party.name,
      openingBalance,
      totalSalesDue,
      totalPurchasesDue,
      totalStandalonePayments,
      outstandingBalance,
      direction,
    };

    return successResponse(data, "Party balance calculated");
  } catch (err) {
    return handleApiError(err);
  }
}