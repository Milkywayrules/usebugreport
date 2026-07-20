import { z } from "zod";

export type { ApiErrorCode, ApiErrorEnvelope } from "./api-envelope";

export const placeholderSchema = z.object({
  version: z.literal("stub"),
});

export type PlaceholderContract = z.infer<typeof placeholderSchema>;

export {
  SURFACE_REGISTRY,
  surfaceMcpSchema,
  surfaceRegistryEntrySchema,
  surfaceRestSchema,
  type SurfaceRegistryEntry,
  type SurfaceRegistryId,
} from "./surface-registry";
