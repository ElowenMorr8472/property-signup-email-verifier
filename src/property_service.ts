import { createServer } from "node:http";
import { ZodError } from "zod";
import { createInfraiEmailClient, InfraiError } from "./infrai_email.js";
import { propertySignupSchema, startPropertySignup } from "./property_signup.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");

const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const port = Number(process.env.PORT ?? 3000);
const infrai = createInfraiEmailClient(apiKey);

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/property-signups") {
    return json(response, 404, { error: "route_not_found" });
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = propertySignupSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const pending = await startPropertySignup(input, origin, infrai);
    return json(response, 202, pending);
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return json(response, 400, { error: "invalid_signup_request" });
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return json(response, status, { error: error.code, message: error.message });
    }
    return json(response, 500, { error: "signup_failed" });
  }
});

function json(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

server.listen(port, () => console.log(`property signup service listening on ${origin}`));
