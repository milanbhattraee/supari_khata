import { z } from "zod/v4";

export const createPaymentSchema = z.object({
  partyId: z.string().min(1, "Select a party"),
  amount: z.number().positive("Amount must be > 0"),
  transactionId: z.string().optional(),
  direction: z.enum(["payin", "payout"]),
  method: z.enum(["cash", "bank_transfer", "cheque", "upi", "other"]).optional(),
  date: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const updatePaymentSchema = z.object({
  direction: z.enum(["payin", "payout"]).optional(),
  method: z.enum(["cash", "bank_transfer", "cheque", "upi", "other"]).optional(),
  date: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type CreatePaymentFormValues = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentFormValues = z.infer<typeof updatePaymentSchema>;
