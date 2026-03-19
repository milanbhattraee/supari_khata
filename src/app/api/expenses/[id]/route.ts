import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Expense from "@/models/expense.model";
import {
  successResponse,
  notFoundResponse,
  handleApiError,
  validationErrorResponse,
} from "@/lib/apiResponse";
import { UpdateExpenseDTO } from "@/types/dto";
import mongoose from "mongoose";
import { centsToMoneyString, toMoneyCents } from "@/lib/financial";
import { toExpenseDTO } from "@/lib/dto-mappers";
import { requireApiAuth } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

// ── GET /api/expenses/:id ─────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;
    const expense = await Expense.findById(id).lean();
    if (!expense) return notFoundResponse("Expense");
    return successResponse(
      toExpenseDTO(expense as unknown as Record<string, unknown>),
      "Expense fetched"
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// ── PUT /api/expenses/:id ─────────────────────────────────────

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;

    const body: Partial<UpdateExpenseDTO> = await req.json();

    const updateFields: Record<string, unknown> = {};

    if (body.amount !== undefined) {
      if (typeof body.amount !== "number" || body.amount <= 0) {
        return validationErrorResponse({ amount: "Amount must be a positive number" });
      }
      const amountCents = toMoneyCents(body.amount);
      updateFields.amount = mongoose.Types.Decimal128.fromString(
        centsToMoneyString(amountCents)
      );
    }

    if (body.description !== undefined) {
      if (!body.description.trim()) {
        return validationErrorResponse({ description: "Description is required" });
      }
      updateFields.description = body.description.trim();
    }

    if (body.date !== undefined) {
      const parsedDate = new Date(body.date);
      if (isNaN(parsedDate.getTime())) {
        return validationErrorResponse({ date: "Invalid date format" });
      }
      updateFields.date = parsedDate;
    }

    const expense = await Expense.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    if (!expense) return notFoundResponse("Expense");

    return successResponse(
      toExpenseDTO(expense as unknown as Record<string, unknown>),
      "Expense updated"
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// ── DELETE /api/expenses/:id ──────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    await dbConnect();
    const { id } = await params;

    const expense = await Expense.findById(id);
    if (!expense) return notFoundResponse("Expense");

    await Expense.deleteOne({ _id: id });

    return successResponse(null, "Expense deleted successfully");
  } catch (err) {
    return handleApiError(err);
  }
}
