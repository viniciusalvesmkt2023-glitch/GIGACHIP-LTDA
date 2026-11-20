import { checkEid, checkIccid, isValidImei, luhnIsValid } from "./validators";

/**
 * Acha IMEI, EID e ICCID no texto lido (OCR) de um print do *#06# ou da foto do chip.
 * Os números às vezes aparecem com espaços, hífens ou quebrados em 2 linhas — por isso juntamos
 * grupos de dígitos e conferimos o dígito verificador antes de sugerir.
 * O resultado é só uma SUGESTÃO: o cliente sempre confere antes de enviar.
 */
export type OcrFound = { imeis: string[]; eid: string | null; iccid: string | null };

/** Grupos de dígitos de cada linha (letra O confundida com zero vira 0). */
function lineGroups(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, "0").match(/\d+/g) ?? [])
    .filter((g) => g.length > 0);
}

export function extractDeviceNumbers(text: string): OcrFound {
  const lines = lineGroups(text);
  // Candidatos, na ordem em que aparecem na tela:
  // - toda junção de grupos VIZINHOS da mesma linha ("35 731272 515730 7" → 15 dígitos;
  //   "357312725157307 / 01" → o IMEI sozinho, sem o "/ 01" da versão de software);
  // - a junção de duas linhas seguidas (EID quebrado em 2 linhas).
  const candidates = new Set<string>();
  lines.forEach((groups, li) => {
    for (let i = 0; i < groups.length; i++) {
      let acc = "";
      for (let j = i; j < groups.length; j++) {
        acc += groups[j];
        if (acc.length > 32) break;
        if (acc.length >= 14) candidates.add(acc);
      }
    }
    const next = lines[li + 1];
    if (next) candidates.add(groups.join("") + next.join(""));
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
