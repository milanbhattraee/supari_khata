import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFiles = [
  path.resolve(__dirname, "../.env.local"),
  path.resolve(__dirname, "../.env"),
];

for (const envFile of envFiles) {
  if (!fs.existsSync(envFile)) continue;
  const raw = fs.readFileSync(envFile, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^['\"]|['\"]$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
const username = (process.env.SEED_USERNAME || "admin").trim().toLowerCase();
const password = process.env.SEED_PASSWORD || "celerioxl12@";
const email = (process.env.SEED_EMAIL || "admin@supari.local").trim().toLowerCase();

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is required to run seed script");
}

if (!username || !password) {
  throw new Error("SEED_USERNAME and SEED_PASSWORD must be provided");
}

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    email: { type: String, required: false, unique: true, sparse: true, trim: true, lowercase: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

async function seed() {
  await mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
    tls: true,
    tlsInsecure: true,
    serverSelectionTimeoutMS: 10000,
  });

  const hashedPassword = await bcrypt.hash(password, 12);

  await User.findOneAndUpdate(
    { username },
    {
      $set: {
        username,
        email,
        password: hashedPassword,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log("Seed user ready:", { username, email });
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
