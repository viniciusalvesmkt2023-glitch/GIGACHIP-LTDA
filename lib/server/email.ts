import "server-only";
import { issueAccessToken } from "./customer-access";
import { sql, type Tx } from "./db";
import { env } from "./env";

/**
 * E-mails automáticos (D22). Ficam numa fila (tabela notifications) e são enviados pelo Resend.
 * Enquanto o domínio/e-mail não estiver configurado, ficam guardados na fila e saem depois.
 * O link de acesso é criado só NA HORA do envio (nunca fica guardado na fila).
 */

export type EmailTemplate = "formulario_ativacao";

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
<p style="line-height:1.6">Para ativarmos sua linha, preencha o <strong>formulário de ativação</strong>. Leva poucos minutos:</p>
<ol style="line-height:1.8;padding-left:20px">
<li>Digite <strong>*#06#</strong> no discador do celular e tire um <strong>print</strong> da tela — o formulário lê ${deviceHint} sozinho;</li>
<li>Assine o <strong>contrato</strong> que chega em outro e-mail, enviado pela <strong>D4Sign</strong> — ela vai pedir uma foto do seu <strong>documento</strong> e uma <strong>selfie</strong> para confirmar sua identidade.</li>
</ol>
${button(p.link, "Abrir formulário de ativação")}
<p style="font-size:13px;color:#64748b;line-height:1.6">O link é pessoal — não compartilhe. Se o botão não funcionar, copie e cole no navegador:<br>${p.link}</p>`,
  );
  const text = `Pagamento confirmado, ${p.firstName}!\n\nPedido ${p.code} (${p.planName}).\nPreencha o formulário de ativação: ${p.link}\n\n1) Digite *#06# no discador e tire um print\n2) Assine o contrato que chega pela D4Sign (com foto do documento e selfie)\n\nGigachip Ltda.`;
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
  const rows = await sql()<{ id: bigint; order_id: string; template: EmailTemplate; attempts: number }[]>`
    update public.notifications set status = 'processing'
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
      const token = await sql().begin((tx) => issueAccessToken(tx, n.order_id, "email"));
      const link = `${env().APP_URL.replace(/\/$/, "")}/acesso/${token}`;
      const content = renderActivationEmail({ firstName: o.full_name.split(/\s+/)[0], code: o.code, planName: o.plan_name, link, simType: o.sim_type });
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
