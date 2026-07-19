import { z } from "zod";

export const placeholderSchema = z.object({
  version: z.literal("stub"),
});

export type PlaceholderContract = z.infer<typeof placeholderSchema>;
