import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

const SECURITY_HEADERS: Record<string, string> = {
  "x-frame-options": "SAMEORIGIN",
  "x-content-type-options": "nosniff",
  "x-xss-protection": "1; mode=block",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(self), microphone=(), geolocation=()",
  "x-robots-tag": "noindex, nofollow, noarchive, nosnippet",
};

const BOT_SIGNATURES = [
  "bot",
  "spider",
  "crawl",
  "slurp",
  "mediapartners",
  "ahrefs",
  "semrush",
  "dotbot",
  "mj12",
  "blex",
  "petal",
  "bytespider",
  "dataforseo",
  "megaindex",
  "gptbot",
  "ccbot",
  "claude",
  "anthropic",
  "cohere",
  "diffbot",
  "curl",
  "wget",
  "python",
  "scrapy",
  "urllib",
  "httpie",
  "axios",
  "postman",
  "insomnia",
  "go-http-client",
  "java/",
  "libwww",
  "zgrab",
  "headlesschrome",
  "phantomjs",
  "selenium",
  "playwright",
  "puppeteer",
];

function isAutomatedBot(request: Request): boolean {
  const ua = (request.headers.get("user-agent") ?? "").toLowerCase();
  // Reject missing, empty or unnaturally short user-agents
  if (!ua || ua.trim().length < 5) return true;
  return BOT_SIGNATURES.some((sig) => ua.includes(sig));
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Edge bot filter: block automated tools, web crawlers, headless browsers and scrapers
    if (isAutomatedBot(request)) {
      return new Response("Access denied: automated requests are blocked.", {
        status: 403,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          ...SECURITY_HEADERS,
        },
      });
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const finalResponse = await normalizeCatastrophicSsrResponse(response);
      
      // Inject security headers on all responses
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        if (!finalResponse.headers.has(key)) {
          finalResponse.headers.set(key, value);
        }
      }
      return finalResponse;
    } catch (error) {
      console.error(error);
      const errRes = brandedErrorResponse();
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        errRes.headers.set(key, value);
      }
      return errRes;
    }
  },
};
