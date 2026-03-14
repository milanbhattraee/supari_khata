import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import UserModel from "@/models/auth.model";
import {
  handleApiError,
  createdResponse,
  badRequestResponse,
} from "@/lib/apiResponse";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { username, password, email } = await req.json();

    if (!username || !password) {
      return badRequestResponse("Username and password are required");
    }

    if (password.length < 6) {
      return badRequestResponse("Password must be at least 6 characters");
    }

    const normalizedUsername = String(username).trim().toLowerCase();
    const normalizedEmail = email ? String(email).trim().toLowerCase() : undefined;

    const existing = await UserModel.findOne({ username: normalizedUsername });
    if (existing) {
      return badRequestResponse("Username already registered");
    }

    if (normalizedEmail) {
      const existingEmail = await UserModel.findOne({ email: normalizedEmail });
      if (existingEmail) {
        return badRequestResponse("Email already registered");
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await UserModel.create({
      username: normalizedUsername,
      ...(normalizedEmail && { email: normalizedEmail }),
      password: hashedPassword,
    });

    return createdResponse(
      { user: { _id: user._id, username: user.username, email: user.email ?? null } },
      "Account created successfully"
    );
  } catch (err) {
    return handleApiError(err);
  }
}
