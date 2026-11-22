"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE } from "@/lib/server/customer-access";

/** "Sair" da Área do Cliente: apaga o acesso deste navegador (o link do e-mail continua valendo). */
export async function sairAction(): Promise<void> {
  (await cookies()).delete(ACCESS_COOKIE);
  redirect("/");
}
