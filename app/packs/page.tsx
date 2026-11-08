import type { Metadata } from "next";
import { DevnetPacks } from "../../components/devnet/packs";
export const metadata: Metadata = { title: "Packs — Plemu" };
export default function Packs() {
  return <DevnetPacks />;
}
