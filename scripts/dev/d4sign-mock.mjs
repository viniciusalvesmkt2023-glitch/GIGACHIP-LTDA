// D4Sign FALSA para desenvolvimento e testes (sem rede). Uso: node scripts/dev/d4sign-mock.mjs [porta]
// Exige tokenAPI e cryptKey na URL, como a API real. Endpoints iguais aos usados pela plataforma.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const port = Number(process.argv[2] ?? 4020);
const SAFE = "11111111-2222-3333-4444-555555555555";
const docs = new Map(); // uuid → { name, pdf: Buffer, signers: [], webhook: null, statusId: "1" }
const calls = [];

const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "Content-Type": type });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  let raw = "";
  for await (const c of req) raw += c;
  const body = raw ? JSON.parse(raw) : {};
  const path = url.pathname.replace(/^\/api\/v1/, "");
  let m;

  if ((m = path.match(/^\/files\/([^/]+)$/))) {
    const d = docs.get(m[1]);
    return d ? send(res, 200, d.pdf, "application/pdf") : send(res, 404, {});
  }
  if (path === "/_test/calls") return send(res, 200, calls);
  if ((m = path.match(/^\/_test\/documents\/([^/]+)\/status$/))) {
    const d = docs.get(m[1]);
    if (!d) return send(res, 404, {});
    d.statusId = body.statusId;
    return send(res, 200, { ok: true, webhook: d.webhook });
  }

  if (!url.searchParams.get("tokenAPI") || !url.searchParams.get("cryptKey")) return send(res, 401, { message: "token inválido" });
  calls.push(`${req.method} ${path}`);

  if (req.method === "GET" && path === "/safes") return send(res, 200, [{ uuid_safe: SAFE, "name-safe": "Site Gigachip" }]);
  if (req.method === "POST" && (m = path.match(/^\/documents\/([^/]+)\/uploadbinary$/))) {
    if (m[1] !== SAFE) return send(res, 404, { message: "cofre não encontrado" });
    if (body.mime_type !== "application/pdf" || !body.base64_binary_file) return send(res, 400, { message: "arquivo inválido" });
    const uuid = randomUUID();
    docs.set(uuid, { name: body.name, pdf: Buffer.from(body.base64_binary_file, "base64"), signers: [], webhook: null, statusId: "1" });
    return send(res, 200, { message: "success", uuid });
  }
  if ((m = path.match(/^\/documents\/([^/]+)(?:\/(\w+))?$/))) {
    const d = docs.get(m[1]);
    if (!d) return send(res, 404, { message: "documento não encontrado" });
    const action = m[2];
    if (req.method === "GET" && !action) return send(res, 200, [{ uuidDoc: m[1], nameDoc: d.name, statusId: d.statusId, statusName: { 1: "Processando", 3: "Aguardando Assinaturas", 4: "Finalizado", 6: "Cancelado" }[d.statusId] }]);
    if (action === "createlist") { d.signers.push(...body.signers); return send(res, 200, { message: [{ success: "1" }] }); }
    if (action === "webhooks") { d.webhook = body.url; return send(res, 200, { message: "success" }); }
    if (action === "sendtosigner") { d.statusId = "3"; return send(res, 200, { message: "File sent to successfully signing" }); }
    if (action === "cancel") { d.statusId = "6"; d.cancelComment = body.comment; return send(res, 200, { message: "success" }); }
    if (action === "download") return send(res, 200, { url: `http://127.0.0.1:${port}/files/${m[1]}`, name: d.name });
  }
  send(res, 404, { message: `não implementado: ${req.method} ${path}` });
}).listen(port, () => console.log(`D4Sign falsa em http://127.0.0.1:${port}/api/v1 (cofre ${SAFE})`));
