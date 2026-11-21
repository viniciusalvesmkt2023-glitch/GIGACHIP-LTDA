import "server-only";
import { env } from "@/lib/server/env";
import type { AsaasBillingType } from "./mapping";

/**
 * Cliente HTTP mínimo da API v3 do Asaas.
 * Sandbox: https://api-sandbox.asaas.com/v3 · Produção: https://api.asaas.com/v3
 * Autenticação: header `access_token`.
 */

export type AsaasCustomer = { id: string; name: string; cpfCnpj: string };

export type AsaasPayment = {
  id: string;
  customer: string;
  subscription?: string | null;
  status: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string; // YYYY-MM-DD
  invoiceUrl: string;
  externalReference?: string | null;
  paymentDate?: string | null;
  confirmedDate?: string | null;
  deleted?: boolean;
};

export type AsaasList<T> = { hasMore: boolean; totalCount: number; limit: number; offset: number; data: T[] };

export type AsaasSubscription = {
  id: string;
  customer: string;
  status: string;
  billingType: AsaasBillingType;
  value: number;
  nextDueDate: string;
  externalReference?: string | null;
};

export type AsaasPixQrCode = { encodedImage: string; payload: string; expirationDate: string };

export class AsaasError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: { code?: string; description?: string }[] = [],
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { ASAAS_API_URL, ASAAS_API_KEY } = env();
  const res = await fetch(`${ASAAS_API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "gigachip-plataforma",
      access_token: ASAAS_API_KEY,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const errors = Array.isArray(json?.errors) ? json.errors : [];
    // Não incluir o corpo da requisição no erro (pode conter dados pessoais)
    throw new AsaasError(`Asaas ${method} ${path} → ${res.status}`, res.status, errors);
  }
  return json as T;
}

export const asaas = {
  createCustomer(input: {
    name: string;
    cpfCnpj: string;
    email: string;
    mobilePhone: string;
    externalReference: string;
  }) {
    return request<AsaasCustomer>("POST", "/customers", input);
  },

  /** Atualiza o e-mail do cliente no Asaas (avisos de cobrança). */
  updateCustomerEmail(customerId: string, email: string) {
    return request<AsaasCustomer>("POST", `/customers/${encodeURIComponent(customerId)}`, { email });
  },

  createSubscription(input: {
    customer: string;
    billingType: AsaasBillingType;
    value: number;
    nextDueDate: string;
    cycle: "MONTHLY";
    description: string;
    externalReference: string;
  }) {
    return request<AsaasSubscription>("POST", "/subscriptions", input);
  },

  deleteSubscription(id: string) {
    return request<{ deleted: boolean; id: string }>("DELETE", `/subscriptions/${encodeURIComponent(id)}`);
  },

  listSubscriptionPayments(subscriptionId: string) {
    return request<{ data: AsaasPayment[] }>(
      "GET",
      `/subscriptions/${encodeURIComponent(subscriptionId)}/payments`,
    );
  },

  /** Lista cobranças por status (página de até 100). Ex.: status OVERDUE = vencidas sem pagamento. */
  listPaymentsByStatus(status: string, offset = 0, limit = 100) {
    const q = new URLSearchParams({ status, offset: String(offset), limit: String(limit) });
    return request<AsaasList<AsaasPayment>>("GET", `/payments?${q}`);
  },

  getCustomer(id: string) {
    return request<AsaasCustomer & { deleted?: boolean }>("GET", `/customers/${encodeURIComponent(id)}`);
  },

  getPayment(id: string) {
    return request<AsaasPayment>("GET", `/payments/${encodeURIComponent(id)}`);
  },

  getPixQrCode(paymentId: string) {
    return request<AsaasPixQrCode>("GET", `/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
  },
};
