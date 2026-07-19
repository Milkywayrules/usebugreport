/** R2 (S3-compatible) client placeholder — wired in E2. */
export function createR2Client(_config: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}) {
  return { status: "stub" as const };
}
