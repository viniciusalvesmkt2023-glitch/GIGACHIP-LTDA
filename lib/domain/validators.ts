/**
 * Validadores de documentos e identificadores usados na contratação.
 *
 * Regra geral: "hard" = bloqueia o envio; "soft" = só avisa o cliente.
 * IMEI e CPF têm regra pública e estável (bloqueiam). EID e ICCID variam entre
 * fabricantes/operadoras, então a verificação de dígito é só um aviso até
 * validarmos com chips e aparelhos reais (docs/07-decisoes.md, D4).
 */

export const onlyDigits = (value: string): string => value.replace(/\D/g, "");

/** Algoritmo de Luhn (mod 10) sobre uma string só de dígitos. */
export function luhnIsValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

/** CPF: 11 dígitos, dois dígitos verificadores, rejeita sequências repetidas. */
export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function formatCpf(input: string): string {
  const d = onlyDigits(input);
  return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/** Mostra só os dígitos do meio: ***.456.789-** */
export function maskCpf(input: string): string {
  const d = onlyDigits(input);
  if (d.length !== 11) return "***.***.***-**";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/** IMEI: 15 dígitos com dígito verificador Luhn. */
export function isValidImei(input: string): boolean {
  const imei = onlyDigits(input);
  return imei.length === 15 && luhnIsValid(imei);
}

export type SoftCheck = {
  /** Formato aceitável — se false, bloqueia. */
  ok: boolean;
  /** Dígito verificador conferido — se false, só avisa o cliente. */
  checksumOk: boolean;
};

/**
 * ICCID (número do chip físico): 19 ou 20 dígitos, começa com 89 (telecom).
 * O último dígito costuma ser Luhn, mas há variações — por isso é aviso, não bloqueio.
 */
export function checkIccid(input: string): SoftCheck {
  const iccid = onlyDigits(input);
  const ok = /^89\d{17,18}$/.test(iccid);
  return { ok, checksumOk: ok && luhnIsValid(iccid) };
}

/**
 * EID (identificador do eSIM): 32 dígitos, começa com 89.
 * Os 2 últimos dígitos são verificadores (ISO 7064 mod 97-10): número inteiro mod 97 = 1.
 */
export function checkEid(input: string): SoftCheck {
  const eid = onlyDigits(input);
  const ok = /^89\d{30}$/.test(eid);
  return { ok, checksumOk: ok && BigInt(eid) % BigInt(97) === BigInt(1) };
}

/** Celular brasileiro → E.164 (+55DDD9XXXXXXXX). Retorna null se inválido. */
export function normalizeBrMobile(input: string): string | null {
  let d = onlyDigits(input);
  if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
  if (!/^[1-9][1-9]9\d{8}$/.test(d)) return null;
  return `+55${d}`;
}
