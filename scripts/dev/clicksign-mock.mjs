// Clicksign FALSA (API v3) para desenvolvimento local e testes (sem rede, sem documentos reais).
// Uso: node scripts/dev/clicksign-mock.mjs [porta] [url-do-webhook] [secret-hmac]
// Atalho de teste: POST /_test/sign/:documentId → finaliza o documento e dispara o aviso (webhook) com HMAC.
import { createServer } from "node:http";
import { createHmac, randomUUID } from "node:crypto";

const port = Number(process.argv[2] ?? 4050);
const webhookUrl = process.argv[3] ?? "http://127.0.0.1:3100/api/webhooks/clicksign";
const secret = process.argv[4] ?? "segredo-de-teste-123";
const envelopes = new Map();
const documents = new Map();
const signers = new Map();
const requirements = [];
const PDF = Buffer.from("%PDF-1.4\n% contrato assinado (falso)\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n" + " ".repeat(200));

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/vnd.api+json" });
  res.end(JSON.stringify(body));
};
const docJson = (d) => ({
  data: {
    id: d.id, type: "documents",
    attributes: { status: d.status, filename: d.filename },
    links: { files: { original: `http://127.0.0.1:${port}/files/${d.id}.pdf`, signed: d.status === "closed" ? `http://127.0.0.1:${port}/files/${d.id}-assinado.pdf` : null } },
  },
});

createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const url = new URL(req.url, "http://x");
  const path = url.pathname.replace(/^\/api\/v3/, "");
  let m;

  if (req.method === "GET" && (m = path.match(/^\/files\/(.+)-assinado\.pdf$/))) {
    res.writeHead(200, { "Content-Type": "application/pdf" });
    return res.end(PDF);
  }
  if (req.method === "POST" && (m = path.match(/^\/_test\/sign\/([^/]+)$/))) {
    const d = documents.get(m[1]);
    if (!d) return send(res, 404, {});
    d.status = "closed";
    const body = JSON.stringify({ event: { name: "auto_close", data: {} }, document: { key: d.id, status: "closed" } });
    const hmac = createHmac("sha256", secret).update(body).digest("hex");
    const r = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json", "Content-Hmac": `sha256=${hmac}` }, body });
    return send(res, 200, { webhook: r.status, resposta: await r.text() });
  }
  if (req.method === "GET" && path === "/_test/state") return send(res, 200, { envelopes: [...envelopes.values()], documents: [...documents.values()].map(({ content, ...d }) => ({ ...d, bytes: content?.length })), signers: [...signers.values()], requirements });

  if (!req.headers["authorization"]) return send(res, 401, { errors: [{ detail: "token ausente" }] });
  const body = raw ? JSON.parse(raw) : {};

  if (req.method === "GET" && path === "/envelopes") return send(res, 200, { data: [] });
  if (req.method === "POST" && path === "/envelopes") {
    const e = { id: randomUUID(), status: "draft", ...body.data.attributes };
    envelopes.set(e.id, e);
    return send(res, 201, { data: { id: e.id, type: "envelopes", attributes: e } });
  }
  if (req.method === "PATCH" && (m = path.match(/^\/envelopes\/([^/]+)$/))) {
    const e = envelopes.get(m[1]);
    if (!e) return send(res, 404, {});
    const reqs = requirements.filter((r) => r.envelope === e.id);
    if (!reqs.some((r) => r.action === "agree") || !reqs.some((r) => r.action === "provide_evidence")) {
      return send(res, 422, { errors: [{ detail: "cada signatário precisa de qualificação e autenticação" }] });
    }
    e.status = body.data.attributes.status;
    for (const d of documents.values()) if (d.envelope === e.id) d.status = "running";
    return send(res, 200, { data: { id: e.id, type: "envelopes", attributes: e } });
  }
  if (req.method === "POST" && (m = path.match(/^\/envelopes\/([^/]+)\/documents$/))) {
    const a = body.data.attributes;
    if (!String(a.content_base64 ?? "").startsWith("data:application/pdf;base64,")) return send(res, 422, { errors: [{ detail: "content_base64 inválido" }] });
    const d = { id: randomUUID(), envelope: m[1], status: "draft", filename: a.filename, content: Buffer.from(a.content_base64.split(",")[1], "base64") };
    documents.set(d.id, d);
    return send(res, 201, docJson(d));
  }
  if (req.method === "GET" && (m = path.match(/^\/envelopes\/([^/]+)\/documents\/([^/]+)$/))) {
    const d = documents.get(m[2]);
    return d ? send(res, 200, docJson(d)) : send(res, 404, {});
  }
  if (req.method === "PATCH" && (m = path.match(/^\/envelopes\/([^/]+)\/documents\/([^/]+)$/))) {
    const d = documents.get(m[2]);
    if (!d) return send(res, 404, {});
    d.status = body.data.attributes.status;
    return send(res, 200, docJson(d));
  }
  if (req.method === "POST" && (m = path.match(/^\/envelopes\/([^/]+)\/signers$/))) {
    const a = body.data.attributes;
    if (!a.name || a.name.trim().split(/\s+/).length < 2 || /\d/.test(a.name)) return send(res, 422, { errors: [{ detail: "nome inválido" }] });
    const s = { id: randomUUID(), envelope: m[1], ...a };
    signers.set(s.id, s);
    return send(res, 201, { data: { id: s.id, type: "signers", attributes: a } });
  }
  if (req.method === "GET" && (m = path.match(/^\/envelopes\/([^/]+)\/requirements$/))) {
    return send(res, 200, { data: requirements.filter((r) => r.envelope === m[1]).map((r) => ({ id: r.id, type: "requirements", attributes: { action: r.action, auth: r.auth ?? null, role: r.role ?? null } })) });
  }
  if (req.method === "POST" && (m = path.match(/^\/envelopes\/([^/]+)\/requirements$/))) {
    const r = { id: randomUUID(), envelope: m[1], ...body.data.attributes, document: body.data.relationships.document.data.id, signer: body.data.relationships.signer.data.id };
    requirements.push(r);
    return send(res, 201, { data: { id: r.id, type: "requirements", attributes: body.data.attributes } });
  }
  if (req.method === "POST" && (m = path.match(/^\/envelopes\/([^/]+)\/notifications$/))) {
    const e = envelopes.get(m[1]);
    if (!e || e.status !== "running") return send(res, 422, { errors: [{ detail: "envelope fora de running" }] });
    e.notified = (e.notified ?? 0) + 1;
    e.lastMessage = body.data.attributes.message;
    return send(res, 201, { data: { type: "notifications", attributes: {} } });
  }
  return send(res, 404, { errors: [{ detail: `sem rota ${req.method} ${path}` }] });
}).listen(port, () => console.log(`Clicksign falsa em http://127.0.0.1:${port}/api/v3`));
