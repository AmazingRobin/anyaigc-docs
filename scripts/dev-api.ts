import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(__dirname, "..");
const FUNCTIONS_DIR = join(ROOT, "functions");
const PORT = Number(process.env.DEV_API_PORT ?? 3002);

function loadDevVars(): Record<string, string> {
  const file = join(ROOT, ".dev.vars");
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const ENV = { ...process.env, ...loadDevVars() };

const METHOD_TO_HANDLER: Record<string, string> = {
  GET: "onRequestGet",
  POST: "onRequestPost",
  PUT: "onRequestPut",
  PATCH: "onRequestPatch",
  DELETE: "onRequestDelete",
  HEAD: "onRequestHead",
  OPTIONS: "onRequestOptions",
};

function resolveHandlerPath(pathname: string): string | null {
  if (!pathname.startsWith("/api/")) return null;
  const rel = pathname.slice(1);
  const candidates = [
    join(FUNCTIONS_DIR, `${rel}.ts`),
    join(FUNCTIONS_DIR, rel, "index.ts"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

async function nodeRequestToWebRequest(
  req: IncomingMessage,
  url: string
): Promise<Request> {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
    else if (typeof v === "string") headers.set(k, v);
  }

  const method = (req.method ?? "GET").toUpperCase();
  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    if (chunks.length > 0) body = Buffer.concat(chunks);
  }

  return new Request(url, { method, headers, body });
}

async function writeWebResponse(webRes: Response, res: ServerResponse) {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => res.setHeader(key, value));
  const buffer = Buffer.from(await webRes.arrayBuffer());
  res.end(buffer);
}

async function loadModule(filePath: string) {
  return import(pathToFileURL(filePath).href + `?t=${Date.now()}`);
}

async function runMiddleware(
  webReq: Request,
  finalHandler: () => Promise<Response>
): Promise<Response> {
  const mwPath = join(FUNCTIONS_DIR, "api", "_middleware.ts");
  if (!existsSync(mwPath)) return finalHandler();
  const mod = await loadModule(mwPath);
  const onRequest = mod.onRequest as
    | ((ctx: {
        request: Request;
        env: typeof ENV;
        params: Record<string, string>;
        next: () => Promise<Response>;
      }) => Promise<Response>)
    | undefined;
  if (typeof onRequest !== "function") return finalHandler();
  return onRequest({ request: webReq, env: ENV, params: {}, next: finalHandler });
}

const server = createServer(async (req, res) => {
  const reqUrl = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      req.headers["access-control-request-headers"] ??
        "Content-Type,Authorization"
    );
  }
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const handlerPath = resolveHandlerPath(reqUrl.pathname);

  if (!handlerPath) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: `No handler for ${reqUrl.pathname}` }));
    return;
  }

  try {
    const webReq = await nodeRequestToWebRequest(req, reqUrl.toString());
    const handlerName =
      METHOD_TO_HANDLER[(req.method ?? "GET").toUpperCase()] ?? "onRequest";

    const finalHandler = async (): Promise<Response> => {
      const mod = await loadModule(handlerPath);
      const fn = (mod[handlerName] ?? mod.onRequest) as
        | ((ctx: {
            request: Request;
            env: typeof ENV;
            params: Record<string, string>;
          }) => Promise<Response>)
        | undefined;
      if (typeof fn !== "function") {
        return new Response(
          JSON.stringify({ error: `Method ${req.method} not allowed` }),
          { status: 405, headers: { "Content-Type": "application/json" } }
        );
      }
      return fn({ request: webReq, env: ENV, params: {} });
    };

    const webRes = await runMiddleware(webReq, finalHandler);
    await writeWebResponse(webRes, res);
  } catch (err) {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    console.error("[dev-api] handler error:", msg);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: msg }));
  }
});

server.listen(PORT, () => {
  console.log(`[dev-api] listening on http://localhost:${PORT}`);
  console.log(`[dev-api] loaded ${Object.keys(loadDevVars()).length} vars from .dev.vars`);
});
