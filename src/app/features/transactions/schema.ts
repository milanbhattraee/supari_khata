import { z } from "zod/v4";

export const createTransactionSchema = z.object({
  type: z.enum(["purchase", "sale"]),
  partyId: z.string().min(1, "Select a party"),
  productId: z.string().min(1, "Select a product"),
  quantity: z.number().positive("Quantity must be > 0"),
  ratePerKg: z.number().positive("Rate must be > 0"),
  paidAmount: z.number().min(0).optional(),
  date: z.string().optional(),
  notes: z.string().optional(),
});

export const updateTransactionSchema = z.object({
  notes: z.string().optional(),
  date: z.string().optional(),
  paidAmount: z.number().min(0).optional(),
});

export type CreateTransactionFormValues = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionFormValues = z.infer<typeof updateTransactionSchema>;
