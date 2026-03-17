import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import ProductionEntry from "@/models/productionEntries.model";
import {
  successResponse,
  createdResponse,
  handleApiError,
  validationErrorResponse,
  parsePagination,
  buildMeta,
} from "@/lib/apiResponse";
import { validateCreateProductionEntry } from "@/lib/validators";
import { CreateProductionEntryDTO } from "@/types/dto";
import mongoose from "mongoose";
import { toProductionDTO } from "@/lib/dto-mappers";
import { requireApiAuth } from "@/lib/api-auth";
import { buildUtcDateRange } from "@/lib/nepal-date-range";

// ── GET /api/production ───────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    const { searchParams } = req.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);

    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const inputProductId = searchParams.get("inputProductId");
    const outputProductId = searchParams.get("outputProductId");

    const filter: Record<string, unknown> = {};
    if (inputProductId) filter.inputProductId = new mongoose.Types.ObjectId(inputProductId);
    if (outputProductId) filter.outputProductId = new mongoose.Types.ObjectId(outputProductId);
    const dateRange = buildUtcDateRange(fromDate, toDate);
    if (dateRange) filter.date = dateRange;

    const [entries, total] = await Promise.all([
      ProductionEntry.find(filter)
        .populate("inputProductId", "name unit")
        .populate("outputProductId", "name unit")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ProductionEntry.countDocuments(filter),
    ]);

    return successResponse(
      entries.map((e) => toProductionDTO(e as Record<string, unknown>)),
      "Production entries fetched",
      200,
      buildMeta(total, page, limit)
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// ── POST /api/production ──────────────────────────────────────
// Pre-save middleware on ProductionEntry model handles:
//   1. Deducting inputProduct stock
//   2. Incrementing outputProduct stock

export async function POST(req: NextRequest) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    const body: Partial<CreateProductionEntryDTO> = await req.json();

    const validation = validateCreateProductionEntry(body);
    if (!validation.valid) return validationErrorResponse(validation.errors);

    if (body.inputProductId === body.outputProductId) {
      return validationErrorResponse({
        outputProductId: "Input and Output product cannot be the same",
      });
    }

    const entry = await new ProductionEntry({
      inputProductId: body.inputProductId,
      inputQuantity: mongoose.Types.Decimal128.fromString(
        String(body.inputQuantity)
      ),
      outputProductId: body.outputProductId,
      outputQuantity: mongoose.Types.Decimal128.fromString(
        String(body.outputQuantity)
      ),
      date: body.date ? new Date(body.date) : new Date(),
      notes: body.notes?.trim(),
    }).save();

    const populated = await ProductionEntry.findById(entry._id)
      .populate("inputProductId", "name unit")
      .populate("outputProductId", "name unit")
      .lean();

    return createdResponse(
      toProductionDTO(populated as Record<string, unknown>),
      "Production entry recorded and stock updated"
    );
  } catch (err) {
    return handleApiError(err);
  }
}