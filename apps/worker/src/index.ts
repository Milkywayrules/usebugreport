import { createIngestFinalizeWorker } from "./jobs/ingest";
import { createRetentionSweepWorker } from "./jobs/retention";

export function bootWorker() {
  const ingestWorker = createIngestFinalizeWorker();
  const retentionWorker = createRetentionSweepWorker();
  ingestWorker.on("failed", (job, error) => {
    console.error("ingest worker job failed", job?.id, error.message);
  });
  retentionWorker.on("failed", (job, error) => {
    console.error("retention worker job failed", job?.id, error.message);
  });
  return { ingestWorker, retentionWorker };
}

if (import.meta.main) {
  const { ingestWorker, retentionWorker } = bootWorker();
  console.log(`ingest.finalize worker listening on queue "${ingestWorker.name}"`);
  console.log(`retention.sweep worker listening on queue "${retentionWorker.name}"`);
}
