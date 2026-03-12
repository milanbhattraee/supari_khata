import { NextResponse } from "next/server";
import { ApiResponse, PaginationMeta } from "@/types/dto";

// ── Success helpers ──────────────────────────────────────────

export function successResponse<T>(
  data: T,
  message = "Success",
  status = 200,
  meta?: PaginationMeta
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, message, data, meta }, { status });
}

export function createdResponse<T>(
  data: T,
  message = "Created successfully"
): NextResponse<ApiResponse<T>> {
  return successResponse(data, message, 201);
}

// ── Error helpers ────────────────────────────────────────────

export function errorResponse(
  message: string,
  status = 500,
  error?: string
): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, message, error }, { status });
}

export function notFoundResponse(
  resource = "Resource"
): NextResponse<ApiResponse> {
  return errorResponse(`${resource} not found`, 404);
}

export function badRequestResponse(
  message: string
): NextResponse<ApiResponse> {
  return errorResponse(message, 400);
}

export function validationErrorResponse(
  errors: Record<string, string>
): NextResponse<ApiResponse> {
  return NextResponse.json(
    {
      success: false,
      message: "Validation failed",
      errors,
    },
    { status: 422 }
  );
}

// ── Central error handler (use in every catch block) ─────────

export function handleApiError(err: unknown): NextResponse<ApiResponse> {
  console.error("[API Error]", err);

  if (err instanceof Error) {
    // Mongoose validation error
    if (err.name === "ValidationError") {
      const mongooseErrors = err as unknown as {
        errors: Record<string, { message: string }>;
      };
      const fieldErrors: Record<string, string> = {};
      Object.keys(mongooseErrors.errors).forEach((key) => {
        fieldErrors[key] = mongooseErrors.errors[key].message;
      });
      return validationErrorResponse(fieldErrors);
    }

    // Mongoose duplicate key error
    if ("code" in err && (err as NodeJS.ErrnoException).code === "11000") {
      return badRequestResponse(
        "A record with this value already exists (duplicate key)"
      );
    }

    // Mongoose CastError (invalid ObjectId)
    if (err.name === "CastError") {
      return badRequestResponse("Invalid ID format");
    }

    // Custom domain errors (thrown from pre-save hooks)
    return errorResponse(err.message, 400, err.name);
  }

  return errorResponse("An unexpected error occurred", 500);
}

// ── Pagination query parser ──────────────────────────────────

export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10))
  );
  return { page, limit, skip: (page - 1) * limit };
}

export function buildMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}