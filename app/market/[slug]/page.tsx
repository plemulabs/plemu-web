import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevnetMarketDetail } from "../../../components/devnet/market-detail";
import {
  marketBySlug,
  marketDirectory,
} from "../../../lib/market-presentation";

export function generateStaticParams() {
  return marketDirectory.map(({ game }) => ({ slug: game.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = marketBySlug(slug);
  return {
    title: item
      ? `${item.config.title} / SOL — Plemu Devnet`
      : "Market not found — Plemu",
  };
}
export default async function MarketPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = marketBySlug(slug);
  if (!item) notFound();
  return <DevnetMarketDetail id={item.config.catalogId} />;
}
