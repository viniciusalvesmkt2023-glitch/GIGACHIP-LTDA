import { ArrowRight, Mail, MessageCircle, Plus } from "lucide-react";
import { FAQ } from "@/lib/faq";
import { CONTACT_EMAIL } from "@/lib/site";

/**
 * Perguntas em cartões (desenhadas no Lovable): número, pergunta e um "+" que vira "×" ao abrir.
 * Usa <details name="faq">: abre uma por vez, sem JavaScript.
 */
export function FaqList({ all = false }: { all?: boolean }) {
  const lista = FAQ.slice(0, all ? FAQ.length : 7);
  return (
    <div className="gc-faq">
      {lista.map((p, i) => (
        <details key={p.q} className="gc-faq-item" name="faq" open={i === 0}>
          <summary className="gc-faq-trigger">
            <span className="gc-faq-num">{String(i + 1).padStart(2, "0")}</span>
            <span className="gc-faq-q">{p.q}</span>
            <span className="gc-faq-icon" aria-hidden="true">
              <Plus size={18} />
            </span>
          </summary>
          <div className="gc-faq-content">
            <p>{p.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}

/** Cartão azul "Ainda com dúvida?" (WhatsApp, se configurado, e e-mail). */
export function FaqContato({ whatsapp }: { whatsapp: string | null }) {
  return (
    <div className="gc-faq-contact">
      <span className="gc-faq-contact-icon" aria-hidden="true">
        <MessageCircle size={22} />
      </span>
      <h3>Ainda com dúvida?</h3>
      <p>Fale com uma pessoa de verdade da nossa equipe. A gente responde rapidinho.</p>
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="gc-faq-contact-btn">
          Falar no WhatsApp <ArrowRight size={16} />
        </a>
      )}
      <a href={`mailto:${CONTACT_EMAIL}`} className="gc-faq-contact-mail">
        <Mail size={14} /> {CONTACT_EMAIL}
      </a>
    </div>
  );
}
