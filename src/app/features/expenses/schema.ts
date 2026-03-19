import { z } from "zod/v4";

export const createExpenseSchema = z.object({
  amount: z.number().positive("Amount must be > 0"),
  description: z.string().min(1, "Description is required"),
  date: z.string().optional(),
});

export const updateExpenseSchema = z.object({
  amount: z.number().positive("Amount must be > 0").optional(),
  description: z.string().min(1, "Description is required").optional(),
  date: z.string().optional(),
});

export type CreateExpenseFormValues = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseFormValues = z.infer<typeof updateExpenseSchema>;
