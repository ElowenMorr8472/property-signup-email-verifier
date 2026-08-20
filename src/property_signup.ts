import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { InfraiEmailClient } from "./infrai_email.js";

export const propertySignupSchema = z.object({
  email: z.string().email(),
  tenantName: z.string().trim().min(1).max(100),
  propertyName: z.string().trim().min(1).max(120),
  maintenanceRequests: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    priority: z.enum(["routine", "urgent"]),
  })).max(20),
  tenantDocuments: z.array(z.object({
    name: z.string().trim().min(1).max(160),
    status: z.enum(["required", "received"]),
  })).max(30),
  inspectionReminders: z.array(z.object({
    scheduledFor: z.string().datetime(),
    kind: z.enum(["move-in", "routine", "move-out"]),
  })).max(20),
});

export type PropertySignup = z.infer<typeof propertySignupSchema>;

export type PendingSignup = {
  status: "pending_email_verification";
  message_id: string;
  verificationToken: string;
  modeled: {
    maintenanceRequestCount: number;
    requiredDocumentCount: number;
    inspectionReminderCount: number;
  };
};

export async function startPropertySignup(
  input: PropertySignup,
  origin: string,
  infrai: InfraiEmailClient,
  token: string = randomBytes(24).toString("hex"),
): Promise<PendingSignup> {
  const verificationUrl = new URL("/verify-email", origin);
  verificationUrl.searchParams.set("token", token);
  const idempotencyKey = createHash("sha256")
    .update(`property-signup:${input.email.toLowerCase()}:${token}`)
    .digest("hex");

  const receipt = await infrai.email.send({
    to: input.email,
    subject: `Verify your email for ${input.propertyName}`,
    html: `<p>Hello ${escapeHtml(input.tenantName)},</p><p><a href="${verificationUrl.toString()}">Verify your email</a> to finish your property signup.</p>`,
    idempotency_key: idempotencyKey,
  });

  return {
    status: "pending_email_verification",
    message_id: receipt.message_id,
    verificationToken: token,
    modeled: {
      maintenanceRequestCount: input.maintenanceRequests.length,
      requiredDocumentCount: input.tenantDocuments.filter((document) => document.status === "required").length,
      inspectionReminderCount: input.inspectionReminders.length,
    },
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character] as string);
}
