import type { Metadata } from "next";
import { LegalDocument } from "../../components/legal-document";
import documents from "../../lib/legal-documents.json";

export const metadata: Metadata = {
  title: "Terms of service | Plemu Labs LLC",
  description: documents.terms.description,
  alternates: { canonical: "https://plemu.xyz/toc" },
};

export default function TermsPage() {
  return <LegalDocument kind="terms" />;
}
