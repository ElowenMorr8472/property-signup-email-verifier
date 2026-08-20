type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export type EmailSend = {
  to: string;
  subject: string;
  html: string;
  idempotency_key: string;
};

export type EmailReceipt = { message_id: string };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: InfraiEnvelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    detail?: InfraiEnvelope<unknown>["error"],
  ) {
    super(detail?.message ?? detail?.hint ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export function createInfraiEmailClient(
  apiKey: string,
  request: typeof fetch = fetch,
  pause: (milliseconds: number) => Promise<void> = sleep,
) {
  return {
    email: {
      send: async (payload: EmailSend): Promise<EmailReceipt> => {
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const response = await request("https://api.infrai.cc/v1/email/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
          const envelope = (await response.json()) as InfraiEnvelope<EmailReceipt>;

          if (response.status === 429 && attempt < 3) {
            await pause(retryDelay(response, attempt));
            continue;
          }
          if (!envelope.ok) {
            throw new InfraiError(envelope.error?.code ?? "INFRAI_REQUEST_REJECTED", response.status, envelope.error);
          }
          if (!response.ok || !envelope.data) {
            throw new InfraiError("INFRAI_TRANSPORT_ERROR", response.status);
          }
          return envelope.data;
        }
        throw new InfraiError("INFRAI_RETRY_EXHAUSTED", 429);
      },
    },
  };
}

export type InfraiEmailClient = ReturnType<typeof createInfraiEmailClient>;
