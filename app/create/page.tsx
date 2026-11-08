import type { Metadata } from "next";
import { DevnetCreate } from "../../components/devnet/utility-pages";
export const metadata: Metadata = { title: "Create — Plemu" };
export default function Create() {
  return <DevnetCreate />;
}
