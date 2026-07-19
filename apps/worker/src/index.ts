import { QUEUE_NAMES } from "@usebugreport/queue";
import { servicesPlaceholder } from "@usebugreport/services";

/** BullMQ consumer stub — job handlers in E2-S4. */
export function bootWorkerStub() {
  return {
    queues: QUEUE_NAMES,
    services: servicesPlaceholder,
    status: "stub" as const,
  };
}

if (import.meta.main) {
  console.log("Worker stub booted:", bootWorkerStub());
}
