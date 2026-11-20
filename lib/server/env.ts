import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente do servidor, validadas na primeira leitura.
 * Nunca importe este arquivo em componentes de cliente.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  FIELD_ENCRYPTION_KEY: z.string().min(1),
  CPF_HASH_KEY: z.string().min(1),
  ASAAS_API_URL: z.string().url(),
  ASAAS_API_KEY: z.string().min(1),
  ASAAS_WEBHOOK_TOKEN: z.string().min(32).max(255).regex(/^\S+$/),
  APP_URL: z.string().url().default("http://localhost:3000"),
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
