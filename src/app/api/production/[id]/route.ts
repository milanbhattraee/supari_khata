import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import ProductionEntry from "@/models/productionEntries.model";
import {
  successResponse,
  notFoundResponse,
  handleApiError,
  badRequestResponse,
} from "@/lib/apiResponse";
import { UpdateProductionEntryDTO } from "@/types/dto";
import { toProductionDTO } from "@/lib/dto-mappers";
import { requireApiAuth } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/production/:id ───────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;
    const entry = await ProductionEntry.findById(id)
      .populate("inputProductId", "name unit")
      .populate("outputProductId", "name unit")
      .lean();
    if (!entry) return notFoundResponse("Production entry");
    return successResponse(
      toProductionDTO(entry as Record<string, unknown>),
      "Production entry fetched"
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// ── PUT /api/production/:id ───────────────────────────────────
// Only notes and date can be edited. Quantities are immutable.

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;

    const body: Partial<UpdateProductionEntryDTO> = await req.json();

    const immutable = ["inputProductId", "outputProductId", "inputQuantity", "outputQuantity"];
    for (const field of immutable) {
      if (field in body) {
        return badRequestResponse(
          `"${field}" cannot be modified. Stock has already been adjusted. Create a new entry if correction is needed.`
        );
      }
    }

    const entry = await ProductionEntry.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.date !== undefined && { date: new Date(body.date) }),
        },
      },
      { new: true }
    )
      .populate("inputProductId", "name unit")
      .populate("outputProductId", "name unit")
      .lean();

    if (!entry) return notFoundResponse("Production entry");

    return successResponse(
      toProductionDTO(entry as Record<string, unknown>),
      "Production entry updated"
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// ── DELETE /api/production/:id ────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    void params;
    return badRequestResponse(
      "Production entries cannot be deleted as stock has already been adjusted. Contact admin for reversal."
    );
  } catch (err) {
    return handleApiError(err);
  }
}