import { describe, expect, it, vi } from "vitest";
import type { InfraiEmailClient } from "../src/infrai_email.js";
import { propertySignupSchema, startPropertySignup } from "../src/property_signup.js";

describe("property signup", () => {
  it("sends one verification link and reports the modeled property workload", async () => {
    const send = vi.fn().mockResolvedValue({ message_id: "msg_42" });
    const infrai = { email: { send } } as InfraiEmailClient;
    const input = propertySignupSchema.parse({
      email: "tenant@example.com",
      tenantName: "Taylor & Lee",
      propertyName: "North House",
      maintenanceRequests: [
        { title: "Check boiler", priority: "urgent" },
        { title: "Replace hallway bulb", priority: "routine" },
      ],
      tenantDocuments: [
        { name: "Lease", status: "received" },
        { name: "Insurance", status: "required" },
      ],
      inspectionReminders: [
        { scheduledFor: "2026-09-01T09:00:00.000Z", kind: "move-in" },
      ],
    });

    const result = await startPropertySignup(input, "https://homes.example", infrai, "fixed-token");

    expect(result).toEqual({
      status: "pending_email_verification",
      message_id: "msg_42",
      verificationToken: "fixed-token",
      modeled: { maintenanceRequestCount: 2, requiredDocumentCount: 1, inspectionReminderCount: 1 },
    });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]).toMatchObject({
      to: "tenant@example.com",
      subject: "Verify your email for North House",
    });
    expect(send.mock.calls[0][0].html).toContain("https://homes.example/verify-email?token=fixed-token");
    expect(send.mock.calls[0][0].html).toContain("Taylor &amp; Lee");
    expect(send.mock.calls[0][0].idempotency_key).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a malformed email before delivery", () => {
    expect(() => propertySignupSchema.parse({
      email: "not-an-email",
      tenantName: "Taylor",
      propertyName: "North House",
      maintenanceRequests: [],
      tenantDocuments: [],
      inspectionReminders: [],
    })).toThrow();
  });
});
