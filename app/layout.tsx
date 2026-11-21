import type { Metadata } from "next";
import { Chakra_Petch, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";

// Poppins no site e no painel (escolhida pelos sócios). Sem o peso 800: os títulos
// "extra negrito" saem em 700, um pouco mais finos, como pedido.
const body = Poppins({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Fonte "tecnológica" parecida com a da logo, só para títulos curtos e números
const display = Chakra_Petch({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
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
      className={`${body.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
