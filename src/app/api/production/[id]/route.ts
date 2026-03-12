import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import ProductionEntry from "@/models/productionEntries.model";
import {
  successResponse,
  notFoundResponse,
  handleApiError,
  badRequestResponse,
} from "@/lib/apiResponse";
import { UpdateProductionEntryDTO, ProductionEntryResponseDTO } from "@/types/dto";
import mongoose from "mongoose";

type RouteContext = { params: Promise<{ id: string }> };

function toProductionDTO(e: Record<string, unknown>): ProductionEntryResponseDTO {
  const input = e.inputProductId as Record<string, unknown>;
  const output = e.outputProductId as Record<string, unknown>;
  const inQty = parseFloat((e.inputQuantity as mongoose.Types.Decimal128).toString());
  const outQty = parseFloat((e.outputQuantity as mongoose.Types.Decimal128).toString());

  return {
    _id: (e._id as { toString(): string }).toString(),
    inputProduct: {
      _id: (input._id as { toString(): string }).toString(),
      name: input.name as string,
      unit: input.unit as ProductionEntryResponseDTO["inputProduct"]["unit"],
    },
    inputQuantity: inQty,
    outputProduct: {
      _id: (output._id as { toString(): string }).toString(),
      name: output.name as string,
      unit: output.unit as ProductionEntryResponseDTO["outputProduct"]["unit"],
    },
    outputQuantity: outQty,
    yieldLoss: parseFloat((inQty - outQty).toFixed(3)),
    date: (e.date as Date).toISOString(),
    notes: (e.notes as string) ?? null,
    createdAt: (e.createdAt as Date).toISOString(),
    updatedAt: (e.updatedAt as Date).toISOString(),
  };
}

// ── GET /api/production/:id ───────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
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
    await dbConnect();
    void params;
    return badRequestResponse(
      "Production entries cannot be deleted as stock has already been adjusted. Contact admin for reversal."
    );
  } catch (err) {
    return handleApiError(err);
  }
}