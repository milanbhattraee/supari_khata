import jwt from "jsonwebtoken";
import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/apiResponse";
import { ApiResponse } from "@/types/dto";

type AuthTokenPayload = {
  userId: string;
  username: string;
};

const JWT_SECRET = process.env.JWT_SECRET;

export function requireApiAuth(
  req: NextRequest
): AuthTokenPayload | NextResponse<ApiResponse> {
  if (!JWT_SECRET) {
    return errorResponse("Server auth configuration missing", 500);
  }

  const token = req.cookies.get("token")?.value;
  if (!token) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
  } catch {
    return errorResponse("Unauthorized", 401);
  }
}
