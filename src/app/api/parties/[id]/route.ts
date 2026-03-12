import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Party from "@/models/parties.model";
import {
  successResponse,
  notFoundResponse,
  handleApiError,
  validationErrorResponse,
} from "@/lib/apiResponse";
import { validateUpdateParty } from "@/lib/validators";
import { UpdatePartyDTO, PartyCategory, PartyResponseDTO } from "@/types/dto";
import mongoose from "mongoose";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/parties/:id ─────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await dbConnect();
    const { id } = await params;

    const party = await Party.findById(id).lean();
    if (!party) return notFoundResponse("Party");

    const data: PartyResponseDTO = {
      _id: party._id.toString(),
      name: party.name,
      phone: party.phone ?? null,
      address: party.address ?? null,
      category: party.category as PartyCategory,
      openingBalance: parseFloat(party.openingBalance?.toString() ?? "0"),
      isActive: party.isActive,
      createdAt: party.createdAt.toISOString(),
      updatedAt: party.updatedAt.toISOString(),
    };

    return successResponse(data, "Party fetched");
  } catch (err) {
    return handleApiError(err);
  }
}

// ── PUT /api/parties/:id ─────────────────────────────────────

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
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

    const party = await Party.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    if (!party) return notFoundResponse("Party");

    const data: PartyResponseDTO = {
      _id: party._id.toString(),
      name: party.name,
      phone: party.phone ?? null,
      address: party.address ?? null,
      category: party.category as PartyCategory,
      openingBalance: parseFloat(party.openingBalance?.toString() ?? "0"),
      isActive: party.isActive,
      createdAt: party.createdAt.toISOString(),
      updatedAt: party.updatedAt.toISOString(),
    };

    return successResponse(data, "Party updated successfully");
  } catch (err) {
    return handleApiError(err);
  }
}

// ── DELETE /api/parties/:id ───────────────────────────────────
// Soft delete — sets isActive: false

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await dbConnect();
    const { id } = await params;

    // Check for dependent transactions before deleting
    const Transaction = mongoose.model("Transaction");
    const txnCount = await Transaction.countDocuments({ partyId: id });
    if (txnCount > 0) {
      // Soft delete only — cannot hard delete a party with history
      const party = await Party.findByIdAndUpdate(
        id,
        { $set: { isActive: false } },
        { new: true }
      );
      if (!party) return notFoundResponse("Party");
      return successResponse(null, "Party deactivated (has transaction history)");
    }

    await Party.findByIdAndDelete(id);
    return successResponse(null, "Party deleted successfully");
  } catch (err) {
    return handleApiError(err);
  }
}