import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Party from "@/models/parties.model";
import {
  successResponse,
  createdResponse,
  handleApiError,
  validationErrorResponse,
  parsePagination,
  buildMeta,
} from "@/lib/apiResponse";
import { validateCreateParty } from "@/lib/validators";
import { CreatePartyDTO, PartyCategory, PartyResponseDTO } from "@/types/dto";

// ── GET /api/parties ─────────────────────────────────────────
// Query params: page, limit, search (name/phone), category

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const { searchParams } = req.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);

    const search = searchParams.get("search") ?? "";
    const category = searchParams.get("category") ?? "";
    const isActive = searchParams.get("isActive");

    // Build dynamic filter
    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (category) filter.category = category;
    if (isActive !== null) filter.isActive = isActive === "true";

    const [parties, total] = await Promise.all([
      Party.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Party.countDocuments(filter),
    ]);

    const data: PartyResponseDTO[] = parties.map((p) => ({
      _id: p._id.toString(),
      name: p.name,
      phone: p.phone ?? null,
      address: p.address ?? null,
      category: p.category as PartyCategory,
      openingBalance: parseFloat(p.openingBalance?.toString() ?? "0"),
      isActive: p.isActive,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    return successResponse(data, "Parties fetched", 200, buildMeta(total, page, limit));
  } catch (err) {
    return handleApiError(err);
  }
}

// ── POST /api/parties ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body: Partial<CreatePartyDTO> = await req.json();

    const validation = validateCreateParty(body);
    if (!validation.valid) return validationErrorResponse(validation.errors);

    const party = await Party.create({
      name: body.name!.trim(),
      phone: body.phone?.trim(),
      address: body.address?.trim(),
      category: body.category,
      openingBalance: body.openingBalance ?? 0,
    });

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

    return createdResponse(data, "Party created successfully");
  } catch (err) {
    return handleApiError(err);
  }
}