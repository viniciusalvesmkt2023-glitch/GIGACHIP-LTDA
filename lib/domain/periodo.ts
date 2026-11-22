/**
 * Período do gráfico de vendas da Visão geral (D34) — regra pura, testável.
 * hoje → por hora; 7 e 30 dias → por dia (incluindo hoje); personalizado → por dia (até 366 dias).
 * Datas em YYYY-MM-DD no horário de São Paulo.
 */
export type Periodo = {
  chave: "hoje" | "7" | "30" | "personalizado";
  de: string;
  ate: string;
  agrupar: "hora" | "dia";
  rotulo: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 366;

function somaDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function valida(iso: string | undefined): iso is string {
  if (!iso || !ISO.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export const brDate = (iso: string) => iso.split("-").reverse().join("/");

export function diasEntre(de: string, ate: string): number {
  return Math.round((new Date(`${ate}T12:00:00Z`).getTime() - new Date(`${de}T12:00:00Z`).getTime()) / 86_400_000) + 1;
}

export function parsePeriodo(p: { periodo?: string; de?: string; ate?: string }, hoje: string): Periodo {
  if (p.periodo === "hoje") return { chave: "hoje", de: hoje, ate: hoje, agrupar: "hora", rotulo: "Hoje" };
  if (p.periodo === "30") return { chave: "30", de: somaDias(hoje, -29), ate: hoje, agrupar: "dia", rotulo: "Últimos 30 dias" };
  if (p.periodo === "personalizado" && valida(p.de) && valida(p.ate)) {
    let [de, ate] = p.de <= p.ate ? [p.de, p.ate] : [p.ate, p.de];
    if (ate > hoje) ate = hoje;
    if (de > ate) de = ate;
    if (diasEntre(de, ate) > MAX_DIAS) de = somaDias(ate, -(MAX_DIAS - 1));
    const agrupar = de === ate ? "hora" : "dia";
    return { chave: "personalizado", de, ate, agrupar, rotulo: de === ate ? brDate(de) : `${brDate(de)} a ${brDate(ate)}` };
  }
  return { chave: "7", de: somaDias(hoje, -6), ate: hoje, agrupar: "dia", rotulo: "Últimos 7 dias" };
}
