import "server-only";
import { createSign } from "node:crypto";
import { env } from "@/lib/server/env";

/**
 * Cliente mínimo da API do Google Planilhas (v4) com "conta de serviço" (usuário robô).
 * A planilha precisa estar compartilhada com o e-mail da conta de serviço como Editor.
 * Autenticação: JWT assinado com a chave privada → token de acesso (OAuth 2.0, RFC 7523).
 */

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export class SheetsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type ServiceAccount = { client_email: string; private_key: string };

function serviceAccount(): ServiceAccount | null {
  const raw = env().GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!j.client_email || !j.private_key) return null;
    return { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export function sheetsConfigured(): boolean {
  return serviceAccount() !== null;
}

/** E-mail do usuário robô (não é segredo: é com ele que a planilha é compartilhada). */
export function serviceAccountEmail(): string | null {
  return serviceAccount()?.client_email ?? null;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

let cachedToken: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const sa = serviceAccount();
  if (!sa) throw new Error("Google Planilhas não configurado (GOOGLE_SERVICE_ACCOUNT_JSON)");
  const tokenUrl = env().GOOGLE_OAUTH_TOKEN_URL;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: tokenUrl, iat: now, exp: now + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(sa.private_key);
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${b64url(signature)}` }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) throw new SheetsError(`Google recusou o login do robô (${json.error ?? res.status})`, res.status);
  cachedToken = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${env().GOOGLE_SHEETS_API_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const textBody = await res.text();
  const json = textBody ? JSON.parse(textBody) : {};
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } }).error?.message ?? "";
    const hint =
      res.status === 403 ? " — compartilhe a planilha com o e-mail do robô como Editor"
      : res.status === 404 ? " — confira o link da planilha"
      : "";
    throw new SheetsError(`Google Planilhas ${res.status}${hint}${msg ? ` (${msg.slice(0, 120)})` : ""}`, res.status);
  }
  return json as T;
}

export type SpreadsheetMeta = {
  properties: { title: string; locale: string };
  sheets: { properties: { sheetId: number; title: string } }[];
};

export type RGB = { red: number; green: number; blue: number };

export const sheets = {
  meta(spreadsheetId: string) {
    const fields = encodeURIComponent("properties(title,locale),sheets(properties(sheetId,title))");
    return request<SpreadsheetMeta>("GET", `/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=${fields}`);
  },

  /** Valores como aparecem na tela (datas e R$ formatados). */
  values(spreadsheetId: string, range: string) {
    return request<{ values?: string[][] }>(
      "GET",
      `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
    );
  },

  /** Escreve várias células como se a pessoa digitasse (datas e R$ viram data e moeda). */
  writeCells(spreadsheetId: string, data: { range: string; value: string }[]) {
    return request("POST", `/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`, {
      valueInputOption: "USER_ENTERED",
      data: data.map((d) => ({ range: d.range, values: [[d.value]] })),
    });
  },

  /** Cor do texto de células (ex.: nome em vermelho = linha bloqueada). */
  setTextColor(spreadsheetId: string, cells: { sheetId: number; row: number; column: number; color: RGB }[]) {
    return request("POST", `/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
      requests: cells.map((c) => ({
        repeatCell: {
          range: { sheetId: c.sheetId, startRowIndex: c.row, endRowIndex: c.row + 1, startColumnIndex: c.column, endColumnIndex: c.column + 1 },
          cell: { userEnteredFormat: { textFormat: { foregroundColor: c.color } } },
          fields: "userEnteredFormat.textFormat.foregroundColor",
        },
      })),
    });
  },
};
