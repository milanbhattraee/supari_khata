import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Party from "@/models/parties.model";
import { successResponse, notFoundResponse, handleApiError } from "@/lib/apiResponse";
import { PartyBalanceResponseDTO, ProductKgBreakdown } from "@/types/dto";
import { requireApiAuth } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/parties/:id/balance ─────────────────────────────
// Returns a full ledger summary for the party.
// Positive outstandingBalance = party owes YOU money
// Negative outstandingBalance = YOU owe the party money

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;

    const party = await Party.findById(id).lean();
    if (!party) return notFoundResponse("Party");

    // Model method is the authoritative source for all balance components.
    const outstanding = await Party.getOutstandingBalance(id);

    let direction: PartyBalanceResponseDTO["direction"];
    if (outstanding.net > 0) direction = "to-receive";
    else if (outstanding.net < 0) direction = "to-pay";
    else direction = "settled";

    // Map to DTO format
    const salesByProduct: ProductKgBreakdown[] = outstanding.salesByProduct.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      kg: p.kg,
    }));
    const purchasesByProduct: ProductKgBreakdown[] = outstanding.purchasesByProduct.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      kg: p.kg,
    }));

    const data: PartyBalanceResponseDTO = {
      partyId: party._id.toString(),
      partyName: party.name,
      openingBalance: outstanding.openingBalance,
      totalSalesDue: outstanding.totalSalesDue,
      totalPurchasesDue: outstanding.totalPurchasesDue,
      totalSalesKg: outstanding.totalSalesKg,
      totalPurchasesKg: outstanding.totalPurchasesKg,
      salesByProduct,
      purchasesByProduct,
      totalStandalonePayments: outstanding.totalStandalonePayments,
      outstandingBalance: outstanding.net,
      direction,
    };

    return successResponse(data, "Party balance calculated");
  } catch (err) {
    return handleApiError(err);
  }
}