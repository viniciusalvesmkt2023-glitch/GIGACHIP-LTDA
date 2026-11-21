import type { Metadata } from "next";
import { Bricolage_Grotesque, Chakra_Petch, Geist_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

// Textos do site e do painel (escolhida pelos sócios: opção A)
const body = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

// Fonte "tecnológica" parecida com a da logo, só para títulos curtos e números
const display = Chakra_Petch({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
});

// Títulos (opção A): moderna, com personalidade — fonte variável, com ajuste óptico para tamanhos grandes
const heading = Bricolage_Grotesque({
  variable: "--font-heading",
  subsets: ["latin"],
  axes: ["opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Gigachip", template: "%s | Gigachip" },
  description: "Contrate sua linha móvel na rede Vivo com a Gigachip, de forma 100% online.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${body.variable} ${geistMono.variable} ${display.variable} ${heading.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
