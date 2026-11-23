import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { ClienteLogin } from "./login-form";

export const metadata: Metadata = { title: "Entrar — Área do Cliente", robots: { index: false } };

export default function EntrarClientePage() {
  return (
    <div className="ck-page">
      <div className="container-site ck-grid is-single">
        <div className="ck-card">
          <ClienteLogin />
          <p className="ck-trust">
            <Lock size={14} /> Seus dados ficam protegidos · nunca pedimos senha por WhatsApp
          </p>
        </div>
      </div>
    </div>
  );
}
