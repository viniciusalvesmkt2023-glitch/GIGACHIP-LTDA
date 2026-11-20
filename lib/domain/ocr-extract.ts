import { checkEid, checkIccid, isValidImei, luhnIsValid } from "./validators";

/**
 * Acha IMEI, EID e ICCID no texto lido (OCR) de um print do *#06# ou da foto do chip.
 * Os números às vezes aparecem com espaços, hífens ou quebrados em 2 linhas — por isso juntamos
 * grupos de dígitos e conferimos o dígito verificador antes de sugerir.
 * O resultado é só uma SUGESTÃO: o cliente sempre confere antes de enviar.
 */
export type OcrFound = { imeis: string[]; eid: string | null; iccid: string | null };

function digitRuns(text: string): string[] {
  // Junta dígitos separados por espaço/hífen/ponto dentro da mesma linha
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, "0").replace(/(?<=\d)[\s.\-/]+(?=\d)/g, ""))
    .flatMap((line) => line.match(/\d{4,}/g) ?? []);
}

export function extractDeviceNumbers(text: string): OcrFound {
  const runs = digitRuns(text);
  // Candidatos: cada sequência e a junção de sequências vizinhas (número quebrado em 2 linhas)
  const candidates = new Set<string>();
  runs.forEach((r, i) => {
    candidates.add(r);
    if (runs[i + 1]) candidates.add(r + runs[i + 1]);
  });

  const imeis: string[] = [];
  let eid: string | null = null;
  let iccid: string | null = null;

  for (const c of candidates) {
    // IMEI: 15 dígitos com dígito verificador (Luhn)
    if (c.length === 15 && isValidImei(c) && !imeis.includes(c)) imeis.push(c);
    if (!eid && c.length === 32 && checkEid(c).ok && checkEid(c).checksumOk) eid = c;
    if (!iccid && (c.length === 19 || c.length === 20) && checkIccid(c).ok && luhnIsValid(c)) iccid = c;
  }
  // EID com dígito verificador estranho só se não houver um válido
  if (!eid) eid = [...candidates].find((c) => c.length === 32 && checkEid(c).ok) ?? null;
  return { imeis, eid, iccid };
}
