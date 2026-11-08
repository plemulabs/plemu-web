import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  PrivacyPreferencesProvider,
  usePrivacyPreferences,
} from "../privacy-preferences";
import { ProductProvider, useProduct } from "../product-provider";
import {
  PRIVACY_CHOICE_KEY,
  TERMS_RECEIPT_KEY,
} from "../../lib/privacy-preferences";

function Harness({ authorized }: { authorized: () => void }) {
  const { requireTerms, openPrivacy } = usePrivacyPreferences();
  const { toggleSaved, saved } = useProduct();
  return (
    <>
      <button
        onClick={async () => {
          if (await requireTerms()) authorized();
        }}
      >
        Request wallet action
      </button>
      <button onClick={openPrivacy}>Change privacy choice</button>
      <button onClick={() => toggleSaved("starfall-protocol")}>
        Save example
      </button>
      <output>{saved.join(",")}</output>
    </>
  );
}

describe("privacy and terms choices", () => {
  beforeEach(() => localStorage.clear());
  function setup() {
    const authorized = vi.fn();
    render(
      <PrivacyPreferencesProvider>
        <ProductProvider>
          <Harness authorized={authorized} />
        </ProductProvider>
      </PrivacyPreferencesProvider>,
    );
    return authorized;
  }

  it("keeps session use available after rejection and saves current state on later opt-in", async () => {
    setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "Use session only" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save example" }));
    expect(screen.getByRole("status").textContent).toContain(
      "starfall-protocol",
    );
    expect(localStorage.getItem("plemu-product-v1")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Change privacy choice" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Allow saved preferences" }),
    );
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem("plemu-product-v1") || "null")?.saved,
      ).toContain("starfall-protocol"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Change privacy choice" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Use session only" }));
    expect(localStorage.getItem("plemu-product-v1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save example" }));
    expect(localStorage.getItem("plemu-product-v1")).toBeNull();
  });

  it("does not confuse optional saving with assent and requires an explicit terms choice", async () => {
    const authorized = setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "Allow saved preferences" }),
    );
    expect(localStorage.getItem(TERMS_RECEIPT_KEY)).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Request wallet action" }),
    );
    const agree = await screen.findByRole("button", {
      name: "Acknowledge draft and continue",
    });
    expect((agree as HTMLButtonElement).disabled).toBe(true);
    expect(authorized).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(authorized).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Request wallet action" }),
    );
    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(
      screen.getByRole("button", { name: "Acknowledge draft and continue" }),
    );
    await waitFor(() => expect(authorized).toHaveBeenCalledOnce());
    expect(localStorage.getItem(TERMS_RECEIPT_KEY)).not.toBeNull();
    expect(
      JSON.parse(localStorage.getItem(PRIVACY_CHOICE_KEY) || "null")
        .persistence,
    ).toBe(true);
  });

  it("responds to a cross-tab denied choice before later optional writes", async () => {
    setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "Allow saved preferences" }),
    );
    localStorage.setItem(
      PRIVACY_CHOICE_KEY,
      JSON.stringify({
        version: 1,
        persistence: false,
        recordedAt: new Date().toISOString(),
      }),
    );
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", { key: PRIVACY_CHOICE_KEY }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save example" }));
    expect(
      JSON.parse(localStorage.getItem(PRIVACY_CHOICE_KEY) || "null")
        .persistence,
    ).toBe(false);
    expect(localStorage.getItem("plemu-product-v1")).toBeNull();
  });
});
