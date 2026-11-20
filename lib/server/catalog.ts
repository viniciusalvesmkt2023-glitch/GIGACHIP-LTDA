import "server-only";
import { connection } from "next/server";
import { sql } from "./db";

/** Plano como exibido no site (DTO público — sem campos internos como vivo_reference). */
export type PublicPlan = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  dataBaseGb: number;
  dataBonusGb: number;
  dataTotalGb: number;
  monthlyPriceCents: number;
  benefits: string[];
  simTypesAllowed: ("esim" | "physical")[];
  seoTitle: string | null;
  seoDescription: string | null;
};

type PlanRow = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  data_base_gb: number;
  data_bonus_gb: number;
  data_total_gb: number;
  monthly_price_cents: number;
  benefits: unknown;
  sim_types_allowed: string;
  seo_title: string | null;
  seo_description: string | null;
};

function parsePgArray(value: string | string[]): string[] {
  if (Array.isArray(value)) return value;
  return value.replace(/^\{|\}$/g, "").split(",").filter(Boolean);
}

function toPublicPlan(r: PlanRow): PublicPlan {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    shortDescription: r.short_description,
    description: r.description,
    dataBaseGb: r.data_base_gb,
    dataBonusGb: r.data_bonus_gb,
    dataTotalGb: r.data_total_gb,
    monthlyPriceCents: r.monthly_price_cents,
    benefits: Array.isArray(r.benefits) ? (r.benefits as string[]) : [],
    simTypesAllowed: parsePgArray(r.sim_types_allowed) as PublicPlan["simTypesAllowed"],
    seoTitle: r.seo_title,
    seoDescription: r.seo_description,
  };
}

export async function listActivePlans(): Promise<PublicPlan[]> {
  await connection();
  const rows = await sql()<PlanRow[]>`
    select id, slug, name, short_description, description, data_base_gb, data_bonus_gb, data_total_gb,
           monthly_price_cents, benefits, sim_types_allowed::text as sim_types_allowed, seo_title, seo_description
    from public.plans where is_active order by sort_order, monthly_price_cents`;
  return rows.map(toPublicPlan);
}

export async function getActivePlanBySlug(slug: string): Promise<PublicPlan | null> {
  await connection();
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const [row] = await sql()<PlanRow[]>`
    select id, slug, name, short_description, description, data_base_gb, data_bonus_gb, data_total_gb,
           monthly_price_cents, benefits, sim_types_allowed::text as sim_types_allowed, seo_title, seo_description
    from public.plans where is_active and slug = ${slug}`;
  return row ? toPublicPlan(row) : null;
}
