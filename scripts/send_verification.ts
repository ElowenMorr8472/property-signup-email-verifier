import { createInfraiEmailClient } from "../src/infrai_email.js";
import { propertySignupSchema, startPropertySignup } from "../src/property_signup.js";

const apiKey = process.env.INFRAI_API_KEY;
const email = process.env.TENANT_EMAIL;
if (!apiKey || !email) throw new Error("INFRAI_API_KEY and TENANT_EMAIL are required");

const signup = propertySignupSchema.parse({
  email,
  tenantName: "Avery Chen",
  propertyName: "Maple Court",
  maintenanceRequests: [{ title: "Kitchen tap inspection", priority: "routine" }],
  tenantDocuments: [{ name: "Signed lease", status: "received" }],
  inspectionReminders: [{ scheduledFor: "2026-09-01T09:00:00.000Z", kind: "move-in" }],
});

const result = await startPropertySignup(
  signup,
  process.env.APP_ORIGIN ?? "http://localhost:3000",
  createInfraiEmailClient(apiKey),
);
console.log(JSON.stringify(result, null, 2));
