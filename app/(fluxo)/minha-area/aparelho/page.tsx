import { redirect } from "next/navigation";

/** Endereço antigo: os dados do chip agora são enviados no formulário de ativação (D38). */
export default function AparelhoPage() {
  redirect("/ativacao");
}
