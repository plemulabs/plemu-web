import type { Metadata } from "next";
import { DevnetGuide } from "../../components/devnet/utility-pages";
import "./guide.css";

export const metadata: Metadata = {
  title: "Guide — Plemu",
  description:
    "Your Plemu field guide. Discover games, understand tokens, open packs and find your first creation. No Web3 experience needed.",
};
export default function Guide() {
  return <DevnetGuide />;
}
