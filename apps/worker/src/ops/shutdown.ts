import type { Worker } from "bullmq";

export async function closeWorkersGracefully(
  workers: Worker[],
  drainTimeoutMs: number
): Promise<void> {
  const closeAll = Promise.all(workers.map((worker) => worker.close()));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      closeAll,
      new Promise<void>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("worker drain timeout exceeded")),
          drainTimeoutMs
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
