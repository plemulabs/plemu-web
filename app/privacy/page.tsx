import type { Metadata } from "next";
import { LegalDocument } from "../../components/legal-document";
import documents from "../../lib/legal-documents.json";

export const metadata: Metadata = {
  title: "Privacy policy | Plemu Labs LLC",
  description: documents.privacy.description,
  alternates: { canonical: "https://plemu.xyz/privacy" },
};

export default function PrivacyPage() {
  return <LegalDocument kind="privacy" />;
}
