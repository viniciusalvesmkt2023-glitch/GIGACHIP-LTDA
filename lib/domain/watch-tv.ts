/**
 * Watch TV vendida junto com a linha (D44). Oferta opcional, sempre desmarcada: só entra se o
 * cliente marcar (nos planos do site ou no passo de pagamento). Uma cobrança só por mês.
 */
export const WATCH_TV = {
  nome: "Watch TV",
  precoCents: 5000,
  telas: 4,
  resumo: "Canais ao vivo, filmes e séries em até 4 TVs · IPTV legalizado",
} as const;

export type WatchTvStatus = "pendente" | "ativo" | "cancelado";

export const WATCH_TV_STATUS: Record<WatchTvStatus, { label: string; tone: "amber" | "green" | "gray" }> = {
  pendente: { label: "Falta liberar", tone: "amber" },
  ativo: { label: "Liberada", tone: "green" },
  cancelado: { label: "Cancelada", tone: "gray" },
};

/** Mensalidade total do pedido: linha + Watch TV (se levou e não cancelou). */
export function totalMensalCents(linhaCents: number, watchCents: number | null, watchStatus: WatchTvStatus | null = null): number {
  return linhaCents + (watchCents && watchStatus !== "cancelado" ? watchCents : 0);
}

/** Parâmetro da página de planos → formulário ("?tv=1" quando o cliente marcou a caixinha). */
export const watchFromQuery = (v: string | string[] | undefined): boolean => (Array.isArray(v) ? v[0] : v) === "1";

/**
 * Grade do pacote "Power Elite + WBD" da Watch (material oficial de revenda; a imagem com as logos
 * fica em /public/watch-canais.webp). Atualizar aqui quando a Watch mudar a grade.
 */
export const WATCH_TV_PACOTE = { nome: "Power Elite + WBD", canais: 102 } as const;

export const WATCH_TV_CANAIS: { titulo: string; grupos: { nome: string; canais: string[] }[] }[] = [
  {
    titulo: "Ao vivo",
    grupos: [
      {
        nome: "TV aberta",
        canais: ["SBT", "Band", "Record TV", "RedeTV!", "TV Aparecida", "Canção Nova", "TV Evangelizar", "Rede Vida", "TV Gazeta", "+Brasil", "Futura", "TV Cultura"],
      },
      { nome: "Notícias", canais: ["Record News", "Jovem Pan News", "CNN", "BandNews TV", "RN", "BM&C News", "Times Brasil CNBC", "New Brasil"] },
      { nome: "Infantil", canais: ["Cartoon Network", "Tooncast", "Discovery Kids", "DD", "TV Rá-Tim-Bum"] },
      {
        nome: "Filmes e séries",
        canais: [
          "TNT", "TNT Séries", "TNT Novelas", "Warner TV", "Cinemax", "Universal Premiere", "Universal Reality", "Universal TV",
          "Space", "TLC", "TCM", "Film&Arts", "Megapix", "USA", "Studio Universal",
        ],
      },
      {
        nome: "Esportes",
        canais: [
          "ge tv", "SporTV", "SporTV 2", "SporTV 3", "ESPN", "ESPN 2", "ESPN 3", "ESPN 4", "ESPN 5", "ESPN 6",
          "Premiere 1", "Premiere 2", "Premiere 3", "Premiere 4", "Premiere 5", "Premiere 6", "Premiere 7", "Premiere 8",
          "BandSports", "N Sports",
        ],
      },
      {
        nome: "Variedades",
        canais: [
          "Adult Swim", "Discovery Turbo", "Food Network", "HGTV", "Home & Health", "Investigation Discovery", "Animal Planet",
          "Discovery Channel", "Agro+", "AgroPlus", "E!", "PlayTV", "Sabor & Arte", "Terraviva",
        ],
      },
    ],
  },
  {
    titulo: "Ao vivo e sob demanda",
    grupos: [
      { nome: "Filmes e séries", canais: ["Telecine Fun", "Telecine Touch", "Telecine Pipoca", "Telecine Cult", "Telecine Action", "Telecine Premium", "AMC", "Film&Arts"] },
      { nome: "Variedades", canais: ["Arte1", "Off", "Canal Brasil", "Globoplay Novelas", "GNT", "Modo Viagem"] },
      { nome: "Infantil", canais: ["Gloobinho", "Moonbug", "Gloob"] },
      { nome: "Música", canais: ["Bis", "Multishow", "Awdio"] },
      { nome: "Notícias", canais: ["CNN Brasil"] },
      {
        nome: "Watch Free",
        canais: ["Acelerados", "Canal do Artesanato", "Desimpedidos", "Fatos Desconhecidos", "Dance", "Good Game TV", "Manual do Mundo", "WhE Play Plus"],
      },
    ],
  },
  {
    titulo: "Sob demanda (VOD)",
    grupos: [{ nome: "Catálogo", canais: ["Universal+", "Edye", "Itaú Cultural Play", "Xpeed School"] }],
  },
];
