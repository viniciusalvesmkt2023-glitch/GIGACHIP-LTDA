// Google Planilhas FALSO para desenvolvimento local e testes (sem rede).
// Uso: node scripts/dev/google-sheets-mock.mjs [porta] [arquivo-chave-publica.pem]
// Confere a assinatura do JWT do usuário robô (se a chave pública for informada).
import { createServer } from "node:http";
import { createVerify } from "node:crypto";
import { readFileSync } from "node:fs";

const port = Number(process.argv[2] ?? 4030);
const publicKey = process.argv[3] ? readFileSync(process.argv[3], "utf8") : null;
/** id → { title, locale, tabs: [{ sheetId, title, values: string[][], colors: {} }] } */
const books = new Map();
const tokens = new Set();

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
const colIndex = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const parseRange = (range) => {
  const m = /^'((?:[^']|'')+)'!([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(range);
  if (!m) return null;
  return { tab: m[1].replace(/''/g, "'"), col: colIndex(m[2]), row: Number(m[3]) - 1 };
};

createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const url = new URL(req.url, "http://x");
  const path = decodeURIComponent(url.pathname);
  let m;

  if (req.method === "POST" && path === "/token") {
    const form = new URLSearchParams(raw);
    const jwt = form.get("assertion") ?? "";
    const [h, c, sig] = jwt.split(".");
    if (form.get("grant_type") !== "urn:ietf:params:oauth:grant-type:jwt-bearer" || !sig) return send(res, 400, { error: "invalid_grant" });
    if (publicKey && !createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(sig, "base64url"))) {
      return send(res, 400, { error: "invalid_grant" });
    }
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    if (!claims.scope?.includes("spreadsheets")) return send(res, 400, { error: "invalid_scope" });
    const token = `tok_${Math.random().toString(36).slice(2)}`;
    tokens.add(token);
    return send(res, 200, { access_token: token, expires_in: 3600, token_type: "Bearer" });
  }

  // Atalhos de teste
  if (req.method === "POST" && (m = path.match(/^\/_test\/books\/([^/]+)$/))) {
    const body = JSON.parse(raw);
    books.set(m[1], {
      title: body.title ?? "Planilha", locale: body.locale ?? "pt_BR",
      tabs: Object.entries(body.tabs).map(([title, values], i) => ({ sheetId: 1000 + i, title, values, colors: {} })),
    });
    return send(res, 200, { ok: true });
  }
  if (req.method === "GET" && (m = path.match(/^\/_test\/books\/([^/]+)$/))) return send(res, 200, books.get(m[1]) ?? null);

  const auth = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (!tokens.has(auth)) return send(res, 401, { error: { message: "token inválido" } });

  if ((m = path.match(/^\/v4\/spreadsheets\/([^/:]+)(.*)$/))) {
    const book = books.get(m[1]);
    if (!book) return send(res, 403, { error: { message: "The caller does not have permission" } });
    const rest = m[2];
    if (req.method === "GET" && rest === "") {
      return send(res, 200, { properties: { title: book.title, locale: book.locale }, sheets: book.tabs.map((t) => ({ properties: { sheetId: t.sheetId, title: t.title } })) });
    }
    let v;
    if (req.method === "GET" && (v = rest.match(/^\/values\/(.+)$/))) {
      const r = parseRange(v[1]);
      const tab = r && book.tabs.find((t) => t.title === r.tab);
      if (!tab) return send(res, 400, { error: { message: "Unable to parse range" } });
      return send(res, 200, { range: v[1], values: tab.values });
    }
    if (req.method === "POST" && rest === "/values:batchUpdate") {
      const body = JSON.parse(raw);
      for (const d of body.data) {
        const r = parseRange(d.range);
        const tab = r && book.tabs.find((t) => t.title === r.tab);
        if (!tab) return send(res, 400, { error: { message: "Unable to parse range" } });
        while (tab.values.length <= r.row) tab.values.push([]);
        const row = tab.values[r.row];
        while (row.length <= r.col) row.push("");
        const val = String(d.values[0][0]);
        row[r.col] = val.startsWith("'") ? val.slice(1) : val; // USER_ENTERED: apóstrofo = texto
      }
      return send(res, 200, { totalUpdatedCells: body.data.length });
    }
    if (req.method === "POST" && rest === ":batchUpdate") {
      const body = JSON.parse(raw);
      for (const rq of body.requests) {
        const g = rq.repeatCell.range;
        const tab = book.tabs.find((t) => t.sheetId === g.sheetId);
        tab.colors[`${g.startRowIndex}:${g.startColumnIndex}`] = rq.repeatCell.cell.userEnteredFormat.textFormat.foregroundColor;
      }
      return send(res, 200, { replies: [] });
    }
  }
  send(res, 404, { error: { message: `${req.method} ${path}` } });
}).listen(port, () => console.log(`Google Planilhas falso em http://localhost:${port}`));
