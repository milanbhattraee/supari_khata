import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/product.model";
import {
  successResponse,
  notFoundResponse,
  handleApiError,
  validationErrorResponse,
  badRequestResponse,
} from "@/lib/apiResponse";
import { UpdateProductDTO, ProductResponseDTO } from "@/types/dto";
import mongoose from "mongoose";

type RouteContext = { params: Promise<{ id: string }> };

function toProductDTO(p: Record<string, unknown>): ProductResponseDTO {
  return {
    _id: (p._id as { toString(): string }).toString(),
    name: p.name as string,
    unit: p.unit as ProductResponseDTO["unit"],
    currentStock: parseFloat(
      (p.currentStock as mongoose.Types.Decimal128)?.toString() ?? "0"
    ),
    description: (p.description as string) ?? null,
    isActive: p.isActive as boolean,
    createdAt: (p.createdAt as Date).toISOString(),
    updatedAt: (p.updatedAt as Date).toISOString(),
  };
}

// ── GET /api/products/:id ─────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await dbConnect();
    const { id } = await params;

    const product = await Product.findById(id).lean();
    if (!product) return notFoundResponse("Product");

    return successResponse(
      toProductDTO(product as Record<string, unknown>),
      "Product fetched"
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// ── PUT /api/products/:id ─────────────────────────────────────

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    await dbConnect();
    const { id } = await params;

    const body: Partial<UpdateProductDTO> = await req.json();

    // Guard: don't allow direct stock edits via this route
    if ("currentStock" in body) {
      return badRequestResponse(
        "Stock cannot be updated directly. Use a Transaction or Production Entry."
      );
    }

    const errors: Record<string, string> = {};
    if (body.name !== undefined && !body.name.trim()) {
      errors.name = "Name cannot be empty";
    }
    if (Object.keys(errors).length) return validationErrorResponse(errors);

    const updateFields: Partial<UpdateProductDTO> = {};
    if (body.name !== undefined) updateFields.name = body.name.trim();
    if (body.unit !== undefined) updateFields.unit = body.unit;
    if (body.description !== undefined) updateFields.description = body.description;
    if (body.isActive !== undefined) updateFields.isActive = body.isActive;

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    if (!product) return notFoundResponse("Product");

    return successResponse(
      toProductDTO(product as Record<string, unknown>),
      "Product updated successfully"
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// ── DELETE /api/products/:id ──────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await dbConnect();
    const { id } = await params;

    const Transaction = mongoose.model("Transaction");
    const txnCount = await Transaction.countDocuments({ productId: id });
    if (txnCount > 0) {
      const product = await Product.findByIdAndUpdate(
        id,
        { $set: { isActive: false } },
        { new: true }
      );
      if (!product) return notFoundResponse("Product");
      return successResponse(null, "Product deactivated (has transaction history)");
    }

    await Product.findByIdAndDelete(id);
    return successResponse(null, "Product deleted successfully");
  } catch (err) {
    return handleApiError(err);
  }
}