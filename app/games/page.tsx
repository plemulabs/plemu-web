import type { Metadata } from "next";
import { DevnetLibrary } from "../../components/devnet/library";
export const metadata: Metadata = { title: "Games — Plemu" };
export default function Games() {
  return <DevnetLibrary />;
}
