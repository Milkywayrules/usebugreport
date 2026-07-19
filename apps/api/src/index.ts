import { servicesPlaceholder } from "@usebugreport/services";
import { Elysia } from "elysia";

export const app = new Elysia()
  .get("/health", () => ({
    services: servicesPlaceholder,
    status: "ok",
  }))
  .get("/", () => ({ message: "usebugreport api stub" }));

if (import.meta.main) {
  app.listen({ hostname: "0.0.0.0", port: 3001 });
}
