import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/dbConnect";
import UserModel from "@/models/auth.model";
import { handleApiError, successResponse, badRequestResponse } from "@/lib/apiResponse";
import { setAuthTokenCookie } from "@/lib/auth-cookie";
import { withAuthRateLimit } from "@/lib/rate-limit";

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(req: NextRequest) {
  try {
    // Rate limit auth routes more strictly
    const rateLimitResponse = withAuthRateLimit(req);
    if (rateLimitResponse) return rateLimitResponse;
    if (!JWT_SECRET) {
      return badRequestResponse("Server authentication is not configured");
    }

    await dbConnect();
    const { username, password } = await req.json();

    if (!username || !password) {
      return badRequestResponse("Username and password are required");
    }

    const normalizedUsername = String(username).trim().toLowerCase();
    const user = await UserModel.findOne({ username: normalizedUsername });
    if (!user) {
      return badRequestResponse("Invalid username or password");
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return badRequestResponse("Invalid username or password");
    }

    const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, {
      expiresIn: "7d",
    });

    const response = successResponse(
      { user: { _id: user._id, username: user.username, email: user.email ?? null } },
      "Login successful"
    );

    setAuthTokenCookie(response, token);

    return response;
  } catch (err) {
    return handleApiError(err);
  }
}
