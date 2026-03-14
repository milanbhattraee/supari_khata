import { z } from "zod/v4";

export const createPartySchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  category: z.enum(["supplier", "customer", "both"]),
  openingBalance: z.number().min(0).optional(),
});

export const updatePartySchema = createPartySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreatePartyFormValues = z.infer<typeof createPartySchema>;
export type UpdatePartyFormValues = z.infer<typeof updatePartySchema>;
