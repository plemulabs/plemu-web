import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TermsPage, { metadata as termsMetadata } from "../toc/page";
import PrivacyPage, { metadata as privacyMetadata } from "../privacy/page";
import documents from "../../lib/legal-documents.json";

describe.each([
  ["terms", TermsPage, termsMetadata],
  ["privacy", PrivacyPage, privacyMetadata],
] as const)("%s legal page", (kind, Page, metadata) => {
  it("is readable without wallet context and links every contents entry to its section", () => {
    const { container } = render(<Page />);
    const document = documents[kind];
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      document.title,
    );
    expect(screen.getByText(documents.status)).toBeDefined();
    expect(
      screen
        .getAllByRole("link", { name: documents.contact })[0]
        .getAttribute("href"),
    ).toBe("mailto:support@plemu.xyz");
    const contents = screen.getByRole("navigation", { name: "On this page" });
    for (const section of document.sections) {
      const link = within(contents).getByRole("link", { name: section.title });
      expect(link.getAttribute("href")).toBe(`#${section.id}`);
      expect(container.querySelector(`[id="${section.id}"]`)?.textContent).toBe(
        section.title,
      );
    }
    const legalNavigation = screen.getByRole("navigation", {
      name: "Legal documents",
    });
    expect(
      within(legalNavigation)
        .getByRole("link", { name: "Terms of service" })
        .getAttribute("href"),
    ).toBe("/toc");
    expect(
      within(legalNavigation)
        .getByRole("link", { name: "Privacy policy" })
        .getAttribute("href"),
    ).toBe("/privacy");
    expect(metadata.alternates?.canonical).toBe(
      `https://plemu.xyz${document.path}`,
    );
  });
});
