import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Party from "@/models/parties.model";
import {
  successResponse,
  notFoundResponse,
  handleApiError,
  validationErrorResponse,
  badRequestResponse,
} from "@/lib/apiResponse";
import { validateUpdateParty } from "@/lib/validators";
import { UpdatePartyDTO, PartyResponseDTO } from "@/types/dto";
import mongoose from "mongoose";
import { toPartyDTO } from "@/lib/dto-mappers";
import { requireApiAuth } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/parties/:id ─────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;

    const party = await Party.findById(id).lean();
    if (!party) return notFoundResponse("Party");

    const data: PartyResponseDTO = toPartyDTO(
      party as unknown as Record<string, unknown>
    );

    return successResponse(data, "Party fetched");
  } catch (err) {
    return handleApiError(err);
  }
}

// ── PUT /api/parties/:id ─────────────────────────────────────

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;

    const body: Partial<UpdatePartyDTO> = await req.json();

    const validation = validateUpdateParty(body);
    if (!validation.valid) return validationErrorResponse(validation.errors);

    // Build update payload — only include defined fields
    const updateFields: Partial<UpdatePartyDTO> = {};
    if (body.name !== undefined) updateFields.name = body.name.trim();
    if (body.phone !== undefined) updateFields.phone = body.phone;
    if (body.address !== undefined) updateFields.address = body.address;
    if (body.category !== undefined) updateFields.category = body.category;
    if (body.openingBalance !== undefined)
      updateFields.openingBalance = body.openingBalance;
    if (body.isActive !== undefined) updateFields.isActive = body.isActive;

    let party: Record<string, unknown> | null = null;

    if (body.openingBalance !== undefined) {
      const Transaction = (await import("@/models/transaction.model")).default;
      const Payment = (await import("@/models/payment.model")).default;
      const session = await mongoose.startSession();

      try {
        await session.withTransaction(async () => {
          const [txnCount, paymentCount] = await Promise.all([
            Transaction.countDocuments(
            { partyId: id },
            { session }
            ),
            Payment.countDocuments(
              { partyId: id },
              { session }
            ),
          ]);
          if (txnCount > 0 || paymentCount > 0) {
            throw new Error(
              "OPENING_BALANCE_LOCKED_AFTER_TRANSACTIONS"
            );
          }

          party = (await Party.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true, runValidators: true, session }
          ).lean()) as Record<string, unknown> | null;
        });
      } catch (err) {
        if (
          err instanceof Error &&
          err.message === "OPENING_BALANCE_LOCKED_AFTER_TRANSACTIONS"
        ) {
          return badRequestResponse(
            "Opening balance cannot be modified after financial records exist. Record an adjustment transaction/payment instead."
          );
        }
        throw err;
      } finally {
        await session.endSession();
      }
    } else {
      party = (await Party.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true, runValidators: true }
      ).lean()) as Record<string, unknown> | null;
    }

    if (!party) return notFoundResponse("Party");

    const data: PartyResponseDTO = toPartyDTO(
      party as unknown as Record<string, unknown>
    );

    return successResponse(data, "Party updated successfully");
  } catch (err) {
    return handleApiError(err);
  }
}

// ── DELETE /api/parties/:id ───────────────────────────────────
// Soft delete — sets isActive: false

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;

    // Check for dependent financial records before deleting
    const Transaction = (await import("@/models/transaction.model")).default;
    const Payment = (await import("@/models/payment.model")).default;
    const [txnCount, paymentCount] = await Promise.all([
      Transaction.countDocuments({ partyId: id }),
      Payment.countDocuments({ partyId: id }),
    ]);

    if (txnCount > 0 || paymentCount > 0) {
      // Soft delete only — cannot hard delete a party with history
      const party = await Party.findByIdAndUpdate(
        id,
        { $set: { isActive: false } },
        { new: true }
      );
      if (!party) return notFoundResponse("Party");
      return successResponse(null, "Party deactivated (has financial history)");
    }

    await Party.findByIdAndDelete(id);
    return successResponse(null, "Party deleted successfully");
  } catch (err) {
    return handleApiError(err);
  }
}