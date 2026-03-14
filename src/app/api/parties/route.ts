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
import { CreatePartyDTO, PartyResponseDTO } from "@/types/dto";
import { toPartyDTO } from "@/lib/dto-mappers";
import { requireApiAuth } from "@/lib/api-auth";

// ── GET /api/parties ─────────────────────────────────────────
// Query params: page, limit, search (name/phone), category

export async function GET(req: NextRequest) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

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

    // Fetch balances for each party gracefully
    const partiesWithBalances = await Promise.all(
      parties.map(async (p) => {
        try {
          const docId = (p as { _id: { toString(): string } })._id.toString();
          const balanceRecord = await Party.getOutstandingBalance(docId);
          const dto = toPartyDTO(p as unknown as Record<string, unknown>);
          dto.balance = {
            receivable: balanceRecord.receivable,
            payable: balanceRecord.payable,
            net: balanceRecord.net,
          };
          return dto;
        } catch {
          return toPartyDTO(p as unknown as Record<string, unknown>);
        }
      })
    );

    const data: PartyResponseDTO[] = partiesWithBalances;
    console.log("Fetched parties:", data);

    return successResponse(data, "Parties fetched", 200, buildMeta(total, page, limit));
  } catch (err) {
    return handleApiError(err);
  }
}

// ── POST /api/parties ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

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

    const data: PartyResponseDTO = toPartyDTO(
      party.toObject() as unknown as Record<string, unknown>
    );


    return createdResponse(data, "Party created successfully");
  } catch (err) {
    return handleApiError(err);
  }
}