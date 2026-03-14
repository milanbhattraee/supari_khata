import { z } from "zod/v4";

export const createProductionSchema = z.object({
  inputProductId: z.string().min(1, "Select input product"),
  inputQuantity: z.number().positive("Quantity must be > 0"),
  outputProductId: z.string().min(1, "Select output product"),
  outputQuantity: z.number().positive("Quantity must be > 0"),
  date: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateProductionFormValues = z.infer<typeof createProductionSchema>;
