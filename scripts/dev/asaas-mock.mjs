// Asaas FALSO para desenvolvimento local e testes automáticos (sem rede, sem dinheiro).
// Implementa só os endpoints usados pela plataforma. Uso: node scripts/dev/asaas-mock.mjs [porta]
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const port = Number(process.argv[2] ?? 4010);
const customers = new Map();
const subscriptions = new Map();
const payments = new Map();
// 1x1 PNG
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  if (!req.headers["access_token"]) return send(res, 401, { errors: [{ code: "invalid_access_token" }] });
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const url = new URL(req.url, "http://x");
  const path = url.pathname.replace(/^\/v3/, "");
  let m;

  if (req.method === "POST" && path === "/customers") {
    const c = { id: `cus_${randomUUID().slice(0, 8)}`, ...body };
    customers.set(c.id, c);
    return send(res, 200, c);
  }
  if (req.method === "POST" && (m = path.match(/^\/customers\/([^/]+)$/))) {
    const c = customers.get(m[1]);
    if (!c) return send(res, 404, { errors: [{ code: "not_found" }] });
    Object.assign(c, body);
    return send(res, 200, c);
  }
  if (req.method === "GET" && path === "/_test/customers") return send(res, 200, [...customers.values()]);
  if (req.method === "POST" && path === "/subscriptions") {
    if (!customers.has(body.customer)) return send(res, 400, { errors: [{ code: "invalid_customer" }] });
    const s = { id: `sub_${randomUUID().slice(0, 8)}`, status: "ACTIVE", ...body };
    subscriptions.set(s.id, s);
    const p = {
      id: `pay_${randomUUID().slice(0, 8)}`, customer: body.customer, subscription: s.id, status: "PENDING",
      billingType: body.billingType, value: body.value, dueDate: body.nextDueDate,
      invoiceUrl: `http://localhost:${port}/fatura`, externalReference: body.externalReference,
    };
    payments.set(p.id, p);
    return send(res, 200, s);
  }
  if (req.method === "POST" && (m = path.match(/^\/subscriptions\/([^/]+)$/))) {
    const s = subscriptions.get(m[1]);
    if (!s) return send(res, 404, { errors: [{ code: "not_found" }] });
    if (body.value !== undefined) s.value = body.value;
    if (body.updatePendingPayments) {
      for (const p of payments.values()) if (p.subscription === s.id && p.status === "PENDING") p.value = s.value;
    }
    return send(res, 200, s);
  }
  if (req.method === "DELETE" && (m = path.match(/^\/subscriptions\/([^/]+)$/))) {
    subscriptions.delete(m[1]);
    return send(res, 200, { deleted: true, id: m[1] });
  }
  if (req.method === "GET" && (m = path.match(/^\/subscriptions\/([^/]+)\/payments$/))) {
    return send(res, 200, { data: [...payments.values()].filter((p) => p.subscription === m[1]) });
  }
  if (req.method === "GET" && (m = path.match(/^\/customers\/([^/]+)$/))) {
    const c = customers.get(m[1]);
    return c ? send(res, 200, c) : send(res, 404, { errors: [{ code: "not_found" }] });
  }
  if (req.method === "GET" && path === "/payments") {
    const status = url.searchParams.get("status");
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 10);
    const all = [...payments.values()].filter((p) => !status || p.status === status);
    return send(res, 200, { object: "list", hasMore: offset + limit < all.length, totalCount: all.length, limit, offset, data: all.slice(offset, offset + limit) });
  }
  // Atalho de teste: cria um cliente "antigo" com uma cobrança (ex.: da planilha) — POST /_test/legacy {name, value, dueDate, status}
  if (req.method === "POST" && path === "/_test/legacy") {
    const c = { id: `cus_${randomUUID().slice(0, 8)}`, name: body.name, cpfCnpj: "00000000000" };
    customers.set(c.id, c);
    const p = {
      id: `pay_${randomUUID().slice(0, 8)}`, customer: c.id, subscription: null, status: body.status ?? "OVERDUE",
      billingType: "PIX", value: body.value, dueDate: body.dueDate, invoiceUrl: `http://localhost:${port}/fatura`,
    };
    payments.set(p.id, p);
    return send(res, 200, { customer: c, payment: p });
  }
  if (req.method === "GET" && (m = path.match(/^\/payments\/([^/]+)\/pixQrCode$/))) {
    return send(res, 200, { encodedImage: PNG, payload: `00020126PIXFALSO${m[1]}`, expirationDate: "2099-01-01 23:59:59" });
  }
  if (req.method === "GET" && (m = path.match(/^\/payments\/([^/]+)$/))) {
    const p = payments.get(m[1]);
    return p ? send(res, 200, p) : send(res, 404, { errors: [{ code: "not_found" }] });
  }
  // Atalho de teste: POST /_test/payments/:id/status {status}
  if (req.method === "POST" && (m = path.match(/^\/_test\/payments\/([^/]+)\/status$/))) {
    const p = payments.get(m[1]);
    if (!p) return send(res, 404, {});
    p.status = body.status;
    return send(res, 200, p);
  }
  if (req.method === "GET" && path === "/_test/payments") return send(res, 200, [...payments.values()]);
  send(res, 404, { errors: [{ code: "not_implemented", description: `${req.method} ${path}` }] });
}).listen(port, () => console.log(`Asaas falso em http://localhost:${port}/v3`));
