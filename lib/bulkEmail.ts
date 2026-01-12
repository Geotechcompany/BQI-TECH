import { sendEmail } from "@/lib/email";

export type BulkEmailRequest = {
  recipients: string[];
  subject: string;
  body: string;
  concurrency?: number;
  dryRun?: boolean;
};

export type BulkEmailResult = {
  requested: number;
  attempted: number;
  succeeded: number;
  failed: number;
  failures: Array<{ to: string; error: string }>;
};

function createChunks<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function sendBulkEmails(
  req: BulkEmailRequest
): Promise<BulkEmailResult> {
  const { recipients, subject, body, concurrency = 10, dryRun = false } = req;

  const uniqueRecipients = Array.from(
    new Set(
      recipients.map((e) => (e || "").trim().toLowerCase()).filter(Boolean)
    )
  );

  if (uniqueRecipients.length === 0) {
    return {
      requested: 0,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      failures: [],
    };
  }

  if (dryRun) {
    return {
      requested: uniqueRecipients.length,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      failures: [],
    };
  }

  const chunks = createChunks(uniqueRecipients, concurrency);
  let succeeded = 0;
  const failures: Array<{ to: string; error: string }> = [];

  for (const group of chunks) {
    await Promise.all(
      group.map(async (to) => {
        try {
          await sendEmail({ to, subject, body });
          succeeded += 1;
        } catch (err: any) {
          failures.push({ to, error: String(err?.message || err) });
        }
      })
    );
  }

  return {
    requested: uniqueRecipients.length,
    attempted: uniqueRecipients.length,
    succeeded,
    failed: uniqueRecipients.length - succeeded,
    failures,
  };
}

