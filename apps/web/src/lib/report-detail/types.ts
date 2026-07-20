export interface ReplayManifestBatch {
  expiresAt: string;
  seq: number;
  url: string;
}

export interface ReplayManifestResponse {
  billingTier: string;
  manifest: {
    batches: ReplayManifestBatch[];
    screenshotUrl: string | null;
  };
  replayExpired: boolean;
  retentionDaysReplay: number;
}

export interface ReportDetailRecord {
  billingTier?: string;
  createdAt: string;
  description: string | null;
  environment: Record<string, unknown>;
  id: string;
  ingestStatus: string;
  projectId: string;
  retentionDaysReplay?: number;
  status: string;
  summary: Record<string, unknown>;
  summaryText: string | null;
  title: string;
  updatedAt: string;
  workspaceSlug: string | null;
}
