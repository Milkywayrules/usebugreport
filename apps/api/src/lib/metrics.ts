type IngestPath = "complete" | "inline";

const DEFAULT_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

interface HistogramState {
  buckets: number[];
  count: number;
  sum: number;
}

const histograms = new Map<IngestPath, HistogramState>();

function getHistogram(path: IngestPath): HistogramState {
  let state = histograms.get(path);
  if (!state) {
    state = { buckets: DEFAULT_BUCKETS.map(() => 0), count: 0, sum: 0 };
    histograms.set(path, state);
  }
  return state;
}

export function observeIngestDuration(path: IngestPath, seconds: number): void {
  const state = getHistogram(path);
  state.count += 1;
  state.sum += seconds;
  for (let index = 0; index < DEFAULT_BUCKETS.length; index += 1) {
    const bucket = DEFAULT_BUCKETS[index];
    if (bucket !== undefined && seconds <= bucket) {
      const current = state.buckets[index] ?? 0;
      state.buckets[index] = current + 1;
    }
  }
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = [
    "# HELP ubr_ingest_duration_seconds Ingest ack duration in seconds",
    "# TYPE ubr_ingest_duration_seconds histogram",
  ];

  for (const path of ["inline", "complete"] as const) {
    const state = histograms.get(path);
    if (!state) {
      continue;
    }

    let cumulative = 0;
    for (let index = 0; index < DEFAULT_BUCKETS.length; index += 1) {
      cumulative += state.buckets[index] ?? 0;
      const le = DEFAULT_BUCKETS[index];
      if (le !== undefined) {
        lines.push(
          `ubr_ingest_duration_seconds_bucket{path="${path}",le="${le}"} ${cumulative}`
        );
      }
    }
    lines.push(
      `ubr_ingest_duration_seconds_bucket{path="${path}",le="+Inf"} ${state.count}`
    );
    lines.push(`ubr_ingest_duration_seconds_sum{path="${path}"} ${state.sum}`);
    lines.push(
      `ubr_ingest_duration_seconds_count{path="${path}"} ${state.count}`
    );
  }

  return `${lines.join("\n")}\n`;
}

/** Test helper — reset in-memory histogram state. */
export function resetMetricsForTests(): void {
  histograms.clear();
}
