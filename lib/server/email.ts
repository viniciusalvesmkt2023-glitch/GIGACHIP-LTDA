import "server-only";
import { formatMsisdn } from "@/lib/domain/lines";
import { issueAccessToken } from "./customer-access";
import { sql, type Tx } from "./db";
import { env } from "./env";

/**
 * E-mails automáticos (D22). Ficam numa fila (tabela notifications) e são enviados pelo Resend.
 * Enquanto o domínio/e-mail não estiver configurado, ficam guardados na fila e saem depois.
 * O link de acesso é criado só NA HORA do envio (nunca fica guardado na fila).
 */

export type EmailTemplate = "formulario_ativacao" | "linha_ativada";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function enqueueEmail(tx: Tx, orderId: string, template: EmailTemplate): Promise<void> {
  await tx`
    insert into public.notifications (order_id, customer_id, channel, template, dedupe_key)
    select o.id, o.customer_id, 'email', ${template}, ${`${template}:${orderId}`}
    from public.orders o where o.id = ${orderId}
    on conflict (dedupe_key) do nothing`;
}

function layout(title: string, body: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#000105;padding:20px 24px;color:#ffffff;font-size:20px;font-weight:bold">GIGA<span style="color:#34FBA6">CHIP</span></td></tr>
<tr><td style="height:4px;background:linear-gradient(90deg,#01BAFE,#34FBA6,#D8FD0D)"></td></tr>
<tr><td style="padding:24px"><h1 style="font-size:20px;margin:0 0 12px">${title}</h1>${body}</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0">Gigachip Ltda. · CNPJ 51.968.628/0001-16<br>Nunca pedimos documentos, senhas ou códigos por e-mail ou WhatsApp.</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${href}" style="background:#0e7490;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:bold;display:inline-block">${label}</a></p>`;

export function renderActivationEmail(p: { firstName: string; code: string; planName: string; link: string; simType: "esim" | "physical" }) {
  const deviceHint = p.simType === "esim" ? "o IMEI e o EID do celular" : "o IMEI do celular e o número do chip (ICCID)";
  const subject = `Pagamento confirmado! Agora é só ativar sua linha (pedido ${p.code})`;
  const html = layout(
    `Pagamento confirmado, ${p.firstName}! 🎉`,
    `<p style="line-height:1.6">Recebemos o pagamento do <strong>${p.planName}</strong> (pedido <strong>${p.code}</strong>).</p>
<p style="line-height:1.6">Para ativarmos sua linha, abra o <strong>formulário de ativação</strong> e siga os passos:</p>
<ol style="line-height:1.8;padding-left:20px">
<li>Digite <strong>*#06#</strong> no discador do celular, tire um <strong>print</strong> e envie no formulário — ele lê ${deviceHint} sozinho;</li>
<li>Assine o <strong>contrato</strong> que chega no seu e-mail pela <strong>D4Sign</strong> (ela pede uma foto do documento e uma selfie);</li>
<li>Toque em <strong>falar no WhatsApp</strong> para pedir a ativação.</li>
</ol>
${button(p.link, "Abrir formulário de ativação")}
<p style="font-size:13px;color:#64748b;line-height:1.6">O link é pessoal — não compartilhe. Se o botão não funcionar, copie e cole no navegador:<br>${p.link}</p>`,
  );
  const text = `Pagamento confirmado, ${p.firstName}!\n\nPedido ${p.code} (${p.planName}).\nPreencha o formulário de ativação: ${p.link}\n\n1) Digite *#06# no discador, tire um print e envie no formulário\n2) Assine o contrato que chega pela D4Sign (com foto do documento e selfie)\n3) Fale com a gente no WhatsApp pelo formulário para ativar\n\nGigachip Ltda.`;
  return { subject, html, text };
}

export function renderActivatedEmail(p: { firstName: string; code: string; planName: string; number: string }) {
  const subject = `Sua linha Gigachip está ativa! (pedido ${p.code})`;
  const html = layout(
    `Sua linha está ativa, ${p.firstName}! ✅`,
    `<p style="line-height:1.6">Ativamos sua linha do <strong>${p.planName}</strong> (pedido <strong>${p.code}</strong>).</p>
<p style="font-size:22px;font-weight:bold;margin:16px 0">${p.number}</p>
<p style="line-height:1.6">Lembretes importantes:</p>
<ul style="line-height:1.8;padding-left:20px">
<li>A mensalidade vence todo mês no mesmo dia da contratação — enviamos lembretes antes.</li>
<li>Pelo contrato, este número <strong>não pode</strong> ser usado para cadastrar WhatsApp nem aplicativos de banco/PIX.</li>
</ul>
<p style="line-height:1.6">Qualquer dúvida, é só responder este e-mail.</p>`,
  );
  const text = `Sua linha está ativa, ${p.firstName}!\n\nPedido ${p.code} (${p.planName})\nNúmero: ${p.number}\n\nLembrete: este número não pode ser usado para cadastrar WhatsApp nem apps de banco/PIX.\n\nGigachip Ltda.`;
  return { subject, html, text };
}

/** Envia um e-mail avulso na hora (ex.: redefinir senha do painel). */
export async function sendEmailNow(to: string, content: { subject: string; html: string; text: string }) {
  if (!emailConfigured()) throw new Error("e-mail ainda não configurado");
  return sendViaResend(to, content);
}

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderPasswordResetEmail(p: { firstName: string; link: string }) {
  const subject = "Redefinir sua senha do painel Gigachip";
  const html = layout(
    "Redefinir senha do painel",
    `<p style="line-height:1.6">Olá, ${esc(p.firstName)}! Recebemos um pedido para redefinir a senha do painel.
Clique no botão para criar uma senha nova. O link vale por <strong>30 minutos</strong> e só pode ser usado uma vez.</p>
${button(p.link, "Criar senha nova")}
<p style="font-size:13px;color:#64748b;line-height:1.6">Se não foi você, ignore este e-mail: sua senha continua a mesma.
Para entrar, o código do aplicativo autenticador (2FA) continua sendo pedido.</p>`,
  );
  const text = `Olá, ${p.firstName}!\n\nPara criar uma senha nova do painel, abra o link (vale 30 minutos, uso único):\n${p.link}\n\nSe não foi você, ignore este e-mail.\n\nGigachip Ltda.`;
  return { subject, html, text };
}

async function sendViaResend(to: string, content: { subject: string; html: string; text: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], ...content }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(`Resend ${res.status}: ${json.message ?? "erro"}`);
  return json.id ?? null;
}

/** Envia os e-mails da fila. Sem configuração de e-mail, não faz nada (ficam aguardando). */
export async function processEmails(limit = 5): Promise<{ sent: number; failed: number; skipped?: string }> {
  if (!emailConfigured()) return { sent: 0, failed: 0, skipped: "e-mail ainda não configurado" };
  let sent = 0;
  let failed = 0;
  // E-mail que ficou "enviando" há mais de 10 min (o servidor caiu no meio): volta para a fila
  await sql()`
    update public.notifications set status = 'queued'
    where status = 'processing' and channel = 'email' and scheduled_for < now() - interval '10 minutes'`;
  const rows = await sql()<{ id: bigint; order_id: string; template: EmailTemplate; attempts: number }[]>`
    update public.notifications set status = 'processing', scheduled_for = now() -- marca a hora em que começou a enviar
    where id in (
      select id from public.notifications
      where status = 'queued' and channel = 'email' and scheduled_for <= now()
      order by scheduled_for limit ${limit} for update skip locked)
    returning id, order_id, template, attempts`;
  for (const n of rows) {
    try {
      const [o] = await sql()<{ code: string; plan_name: string; sim_type: "esim" | "physical"; full_name: string; email: string }[]>`
        select o.code, o.plan_snapshot->>'name' as plan_name, o.sim_type::text as sim_type, c.full_name, c.email::text as email
        from public.orders o join public.customers c on c.id = o.customer_id where o.id = ${n.order_id}`;
      const firstName = o.full_name.split(/\s+/)[0];
      let content: { subject: string; html: string; text: string };
      if (n.template === "linha_ativada") {
        const [l] = await sql()<{ msisdn: string }[]>`select msisdn from public.lines where order_id = ${n.order_id}`;
        content = renderActivatedEmail({ firstName, code: o.code, planName: o.plan_name, number: l ? formatMsisdn(l.msisdn) : "" });
      } else {
        const token = await sql().begin((tx) => issueAccessToken(tx, n.order_id, "email"));
        const link = `${env().APP_URL.replace(/\/$/, "")}/acesso/${token}`;
        content = renderActivationEmail({ firstName, code: o.code, planName: o.plan_name, link, simType: o.sim_type });
      }
      const id = await sendViaResend(o.email, content);
      await sql()`update public.notifications set status = 'done', sent_at = now(), provider_message_id = ${id}, attempts = attempts + 1, last_error = null where id = ${n.id}`;
      sent++;
    } catch (err) {
      failed++;
      const attempts = n.attempts + 1;
      await sql()`
        update public.notifications
        set status = ${attempts >= 5 ? "failed" : "queued"}, attempts = ${attempts}, last_error = ${String(err)},
            scheduled_for = now() + make_interval(mins => ${15 * attempts})
        where id = ${n.id}`;
    }
  }
  return { sent, failed };
}
