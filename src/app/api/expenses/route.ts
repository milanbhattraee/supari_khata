import { NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Expense from "@/models/expense.model";
import {
  successResponse,
  createdResponse,
  handleApiError,
  validationErrorResponse,
  parsePagination,
  buildMeta,
} from "@/lib/apiResponse";
import { validateCreateExpense } from "@/lib/validators";
import { CreateExpenseDTO, ExpenseQueryDTO } from "@/types/dto";
import mongoose from "mongoose";
import { centsToMoneyString, toMoneyCents } from "@/lib/financial";
import { toExpenseDTO } from "@/lib/dto-mappers";
import { requireApiAuth } from "@/lib/api-auth";
import { buildUtcDateRange } from "@/lib/nepal-date-range";

// ── GET /api/expenses ─────────────────────────────────────────
// Query: fromDate, toDate, page, limit

export async function GET(req: NextRequest) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    const { searchParams } = req.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);
    const query = Object.fromEntries(searchParams.entries()) as ExpenseQueryDTO;

    const filter: Record<string, unknown> = {};
    const dateRange = buildUtcDateRange(query.fromDate, query.toDate);
    if (dateRange) filter.date = dateRange;

    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Expense.countDocuments(filter),
    ]);

    return successResponse(
      expenses.map((e) => toExpenseDTO(e as unknown as Record<string, unknown>)),
      "Expenses fetched",
      200,
      buildMeta(total, page, limit)
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// ── POST /api/expenses ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = requireApiAuth(req);
    if (auth instanceof Response) return auth;

    await dbConnect();

    const body: Partial<CreateExpenseDTO> = await req.json();

    const validation = validateCreateExpense(body);
    if (!validation.valid) return validationErrorResponse(validation.errors);

    const amountCents = toMoneyCents(Number(body.amount));

    const expense = await Expense.create({
      amount: mongoose.Types.Decimal128.fromString(centsToMoneyString(amountCents)),
      description: body.description?.trim(),
      date: body.date ? new Date(body.date) : new Date(),
    });

    const populated = await Expense.findById(expense._id).lean();

    return createdResponse(
      toExpenseDTO(populated as unknown as Record<string, unknown>),
      "Expense recorded successfully"
    );
  } catch (err) {
    return handleApiError(err);
  }
}
