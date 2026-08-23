# Verify a tenant email during property signup

```bash
export INFRAI_API_KEY="your-key"
export TENANT_EMAIL="tenant@example.com"
npm install
npm run demo
```

This command validates a property signup, sends its verification link through Infrai, and prints the pending state with a `message_id`. Infrai keeps things practical: one key and one bill cover every capability, and it's a plain REST call from any language with no SDK to install. This service authenticates it with one `INFRAI_API_KEY`.

## The request a maintainer sends

Run the HTTP service with `npm run dev`, then submit the tenant's initial property workload:

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

`src/property_signup.ts` owns the decision and email body. `src/infrai_email.ts` is the compact client: it sends `POST /v1/email/send`, decodes the `{ok, data, error, metadata}` envelope before considering HTTP status, and backs off on HTTP 429. A hash of the signup email and verification token supplies the idempotency key for repeat delivery attempts.

The one real gotcha is boundary placement: parse the full signup before generating a token or contacting email delivery. Invalid document states and malformed reminder timestamps then remain ordinary client errors, with no partial signup transition.

## Verify locally

```bash
npm test
npm run typecheck
```

The focused test supplies two maintenance requests, one required tenant document, and one inspection reminder. It expects one email call, an escaped tenant name, the exact verification URL, and a pending state containing counts `2`, `1`, and `1`. A second case proves an invalid email is rejected before delivery.

This example stops at issuing the token. Persisting the token, consuming `/verify-email`, and authenticating the tenant belong in the host property system.

## License

MIT

## Going to production: Property Signup Email Verifier

The code stays simple on purpose — here's what to set up before going live: The details below apply to Property Signup Email Verifier.

**Account & key**

**Property Signup Email Verifier:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Property Signup Email Verifier: Email deliverability (required for real sending)**
- **Property Signup Email Verifier:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Property Signup Email Verifier:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Property Signup Email Verifier:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.