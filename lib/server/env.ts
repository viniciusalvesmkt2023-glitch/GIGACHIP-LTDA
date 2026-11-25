import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente do servidor, validadas na primeira leitura.
 * Nunca importe este arquivo em componentes de cliente.
 */
/** Variável opcional: vazia ou só com espaços conta como "não configurada" (nunca derruba o site). */
const optional = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() || undefined : v), inner.optional());

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  FIELD_ENCRYPTION_KEY: z.string().min(1),
  CPF_HASH_KEY: z.string().min(1),
  ASAAS_API_URL: z.string().url(),
  ASAAS_API_KEY: z.string().min(1),
  ASAAS_WEBHOOK_TOKEN: z.string().min(32).max(255).regex(/^\S+$/),
  /**
   * Endereço público do site (links dos e-mails, aviso da D4Sign). Sem a variável, usa o domínio
   * de produção que a própria Vercel informa (VERCEL_PROJECT_PRODUCTION_URL); fora da Vercel, localhost.
   */
  APP_URL: z.string().url().default(
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000",
  ),
  /** Libera a criação do 1º usuário do painel (só funciona enquanto não houver ninguém na equipe). */
  ADMIN_SETUP_TOKEN: z.string().min(20).optional(),
  // D4Sign (opcional: sem estas variáveis o envio de contratos fica desligado)
  D4SIGN_API_URL: z.string().url().default("https://secure.d4sign.com.br/api/v1"),
  D4SIGN_TOKEN_API: z.string().min(1).optional(),
  D4SIGN_CRYPT_KEY: z.string().min(1).optional(),
  D4SIGN_SAFE_UUID: z.string().regex(/^[0-9a-f-]{36}$/i).optional(),
  /** Senha que vai na URL do aviso da D4Sign (o sistema só aceita avisos com ela). 32+ caracteres. */
  D4SIGN_WEBHOOK_SECRET: z.string().min(32).regex(/^[A-Za-z0-9_-]+$/).optional(),
  D4SIGN_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(10),
  // Clicksign (D45): contratos NOVOS vão por ela quando o token existe; os antigos terminam na D4Sign
  /** Produção: https://app.clicksign.com/api/v3 · Teste (sandbox): https://sandbox.clicksign.com/api/v3 */
  CLICKSIGN_API_URL: z.string().url().default("https://app.clicksign.com/api/v3"),
  /** Clicksign → Configurações → API → access token. */
  CLICKSIGN_ACCESS_TOKEN: optional(z.string().min(10)),
  /** "HMAC SHA256 Secret" que a Clicksign mostra ao cadastrar o webhook (confere os avisos). */
  CLICKSIGN_WEBHOOK_SECRET: optional(z.string().min(8)),
  // Google Planilhas (opcional): conteúdo do arquivo JSON da conta de serviço ("usuário robô")
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
  GOOGLE_OAUTH_TOKEN_URL: z.string().url().default("https://oauth2.googleapis.com/token"),
  GOOGLE_SHEETS_API_URL: z.string().url().default("https://sheets.googleapis.com/v4"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Variáveis de ambiente ausentes ou inválidas: ${missing}`);
    }
    cached = parsed.data;
  }
  return cached;
}
