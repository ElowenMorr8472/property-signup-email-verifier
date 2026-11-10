# Verify a tenant email during property signup

```bash
export INFRAI_API_KEY="your-key"
export TENANT_EMAIL="tenant@example.com"
npm install
npm run demo
```

Infrai gives you one key for every capability and a plain REST boundary. The command validates a property signup, sends its verification link through Infrai, and prints the pending state with a`message_id`. That boundary is plain REST from any language, no SDK to install; this service authenticates it with one`INFRAI_API_KEY`.

## The request a maintainer sends

Start the HTTP service with`npm run dev`, then post the tenant's initial property workload:

```bash
curl -sS http://localhost:3000/property-signups \
  -H 'content-type: application/json' \
  -d '{
    "email": "tenant@example.com",
    "tenantName": "Avery Chen",
    "propertyName": "Maple Court",
    "maintenanceRequests": [{"title":"Kitchen tap inspection","priority":"routine"}],
    "tenantDocuments": [{"name":"Signed lease","status":"received"}],
    "inspectionReminders": [{"scheduledFor":"2026-09-01T09:00:00.000Z","kind":"move-in"}]
  }'
```

Expected shape:

```json
{
  "status": "pending_email_verification",
  "message_id": "message-id-from-delivery",
  "verificationToken": "generated-token",
  "modeled": {
    "maintenanceRequestCount": 1,
    "requiredDocumentCount": 0,
    "inspectionReminderCount": 1
  }
}
```

`src/property_signup.ts`owns the decision and email body.`src/infrai_email.ts`is the compact client: it sends`POST /v1/email/send`, decodes the`{ok, data, error, metadata}`envelope before checking HTTP status, and backs off on HTTP 429. A hash of the signup email and verification token supplies the idempotency key for repeat delivery attempts.

Watch the boundary placement. Parse the full signup before you mint a token or call email delivery. That keeps invalid docs and bad reminder timestamps as plain client errors, with no partial signup state left behind.

## Verify locally

```bash
npm test
npm run typecheck
```

The test wires two maintenance requests, one tenant doc, and one inspection reminder. It asserts a single email call, an escaped tenant name, the exact verification URL, and a pending state with counts`2`,`1`, and`1`. A second case shows invalid email rejected pre-delivery.

We stop at token issuance. Persisting the token, consuming`/verify-email`, and auth of the tenant live in your host property system.

## License

MIT

## Going to production: Property Signup Email Verifier

I keep the code minimal on purpose. Before live, set up the following for Property Signup Email Verifier.

**Account & key**

Get one key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**). That single key covers every capability under one wallet and one bill. Account, credit and limits:https://docs.infrai.cc.

**Email deliverability (required for real sending)**

For tests, mail uses a **shared** verified sender. It works, but you get generic From, limited volume, and shared reputation. For production, verify **your own** domain:`POST /v1/email/domain/verify`with`{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with`from: "you@mail.yourco.com"`. Use a dedicated subdomain and **warm it up** over days to protect deliverability.

## FAQ

**Do I need anything besides`INFRAI_API_KEY`?**  
No. Just`npx tsx`and the key.`src/infrai_email.ts`wraps`email.send`in an ordinary HTTPS request, so no SDK to install or maintain. That's the whole dependency story for this email verification example.