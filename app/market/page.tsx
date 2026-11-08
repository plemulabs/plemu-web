import type { Metadata } from "next";
import { DevnetMarkets } from "../../components/devnet/markets";
export const metadata: Metadata = { title: "Market — Plemu" };
export default function Market() {
  return <DevnetMarkets />;
}
