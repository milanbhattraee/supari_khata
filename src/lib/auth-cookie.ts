import { NextResponse } from "next/server";

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function setAuthTokenCookie(response: NextResponse, token: string): void {
  response.cookies.set("token", token, {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function clearAuthTokenCookie(response: NextResponse): void {
  response.cookies.set("token", "", {
    ...baseCookieOptions,
    maxAge: 0,
  });
}
