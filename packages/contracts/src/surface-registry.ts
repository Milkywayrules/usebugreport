/** Surface registry — populated in E6-S2. */
export const surfaceRegistry = [] as const;

export type SurfaceRegistryEntry = (typeof surfaceRegistry)[number];
