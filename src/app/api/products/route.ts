import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/product.model";
import {
  successResponse,
  createdResponse,
  handleApiError,
  validationErrorResponse,
  parsePagination,
  buildMeta,
} from "@/lib/apiResponse";
import { validateCreateProduct } from "@/lib/validators";
import { CreateProductDTO } from "@/types/dto";
import mongoose from "mongoose";
import { toProductDTO } from "@/lib/dto-mappers";
import { requireApiAuth } from "@/lib/api-auth";

// ── GET /api/products ─────────────────────────────────────────
// Query params: page, limit, search, isActive, lowStock (threshold kg)

export async function GET(req: NextRequest) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    const { searchParams } = req.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);

    const search = searchParams.get("search") ?? "";
    const isActive = searchParams.get("isActive");
    const lowStock = searchParams.get("lowStock"); // e.g. "50" means show products with stock < 50kg

    const filter: Record<string, unknown> = {};
    if (search) filter.name = { $regex: search, $options: "i" };
    if (isActive !== null) filter.isActive = isActive === "true";
    if (lowStock) {
      filter.currentStock = {
        $lt: mongoose.Types.Decimal128.fromString(lowStock),
      };
    }

    const [products, total] = await Promise.all([
      Product.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);

    return successResponse(
      products.map((p) => toProductDTO(p as Record<string, unknown>)),
      "Products fetched",
      200,
      buildMeta(total, page, limit)
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// ── POST /api/products ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    const body: Partial<CreateProductDTO> = await req.json();

    const validation = validateCreateProduct(body);
    if (!validation.valid) return validationErrorResponse(validation.errors);

    const product = await Product.create({
      name: body.name!.trim(),
      unit: body.unit ?? "kg",
      description: body.description?.trim(),
      currentStock: body.currentStock ?? 0,
    });

    return createdResponse(
      toProductDTO(product.toObject() as Record<string, unknown>),
      "Product created successfully"
    );
  } catch (err) {
    return handleApiError(err);
  }
}