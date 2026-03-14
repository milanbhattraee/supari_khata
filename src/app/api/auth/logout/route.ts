import { NextRequest } from "next/server";
import { handleApiError, successResponse } from "@/lib/apiResponse";
import { clearAuthTokenCookie } from "@/lib/auth-cookie";
import { requireApiAuth } from "@/lib/api-auth";

export async function POST(_req: NextRequest) {
  try {
    const auth = requireApiAuth(_req);
    if (auth instanceof Response) return auth;

    const response = successResponse(null, "Logged out");
    clearAuthTokenCookie(response);
    return response;
  } catch (err) {
    return handleApiError(err);
  }
}
