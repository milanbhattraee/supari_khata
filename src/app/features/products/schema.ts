import { z } from "zod/v4";

export const createProductSchema = z.object({
  name: z.string().min(1, "Name is required"),
  unit: z.enum(["kg", "quintal"]).optional(),
  description: z.string().optional(),
  currentStock: z.number().min(0).optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateProductFormValues = z.infer<typeof createProductSchema>;
export type UpdateProductFormValues = z.infer<typeof updateProductSchema>;
