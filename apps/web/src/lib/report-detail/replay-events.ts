import type { ReplayManifestBatch } from "./types";

export async function loadReplayEvents(
  batches: ReplayManifestBatch[]
): Promise<unknown[]> {
  const sorted = [...batches].sort((a, b) => a.seq - b.seq);
  const events: unknown[] = [];

  for (const batch of sorted) {
    if (!batch.url) {
      continue;
    }
    const response = await fetch(batch.url);
    if (!response.ok) {
      throw new Error(`Failed to load replay batch ${batch.seq}`);
    }
    const compressed = await response.arrayBuffer();
    const stream = new DecompressionStream("gzip");
    const decompressed = await new Response(
      new Blob([compressed]).stream().pipeThrough(stream)
    ).arrayBuffer();
    const parsed = JSON.parse(new TextDecoder().decode(decompressed));
    if (Array.isArray(parsed)) {
      events.push(...parsed);
    }
  }

  return events;
}
