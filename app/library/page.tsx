import type { Metadata } from "next";
import { DevnetLibrary } from "../../components/devnet/library";
export const metadata: Metadata = { title: "Library — Plemu" };
export default function Library() {
  return <DevnetLibrary />;
}
