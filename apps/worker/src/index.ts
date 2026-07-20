import { createIngestFinalizeWorker } from "./jobs/ingest";

export function bootWorker() {
  const worker = createIngestFinalizeWorker();
  worker.on("failed", (job, error) => {
    console.error("ingest worker job failed", job?.id, error.message);
  });
  return worker;
}

if (import.meta.main) {
  const worker = bootWorker();
  console.log(`ingest.finalize worker listening on queue "${worker.name}"`);
}
