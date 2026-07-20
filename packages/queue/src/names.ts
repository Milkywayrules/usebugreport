/** BullMQ queue bucket names (architecture §4). */
export const QUEUE_NAMES = {
  DELETION: "deletion",
  INGEST: "ingest",
  INTEGRATIONS: "integrations",
  RETENTION: "retention",
  WEBHOOKS: "webhooks",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Job identifiers within queue buckets (architecture §4). */
export const JOB_NAMES = {
  DELETION_STEP: "deletion.step",
  DELETION_AUDIT_TERMINAL: "deletion.audit_terminal",
  DELETION_EXTERNAL_PURGE: "deletion.external_purge",
  DELETION_NOTIFY_OWNER: "deletion.notify_owner",
  DELETION_POSTGRES_PURGE: "deletion.postgres_purge",
  INGEST_FINALIZE: "ingest.finalize",
  INTEGRATIONS_LINEAR_PUSH: "integrations.linear_push",
  RETENTION_SWEEP: "retention.sweep",
  WEBHOOKS_DELIVER: "webhooks.deliver",
  WEBHOOKS_DISPATCH: "webhooks.dispatch",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
