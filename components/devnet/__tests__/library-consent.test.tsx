import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
const preferences = vi.hoisted(() => ({ persistence: false, ready: true }));
vi.mock("../../privacy-preferences", () => ({
  usePrivacyPreferences: () => preferences,
}));
import { BrowserLibraryProvider, useBrowserLibrary } from "../library-provider";
import { choosePersistence } from "../../../lib/privacy-preferences";
function View() {
  const l = useBrowserLibrary();
  return (
    <>
      <output data-testid="saved">{JSON.stringify(l.favorites)}</output>
      <button onClick={() => l.toggleFavorite("gb/adjustris")}>Save</button>
    </>
  );
}
const app = () => (
  <BrowserLibraryProvider>
    <View />
  </BrowserLibraryProvider>
);
beforeEach(() => {
  cleanup();
  localStorage.clear();
  preferences.persistence = false;
  choosePersistence(false);
});
describe("consent transition", () => {
  it("preserves this session’s saved game when optional persistence is enabled later", async () => {
    const mounted = render(app());
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByTestId("saved").textContent).toBe('["gb/adjustris"]');
    choosePersistence(true);
    preferences.persistence = true;
    mounted.rerender(app());
    await waitFor(() =>
      expect(screen.getByTestId("saved").textContent).toBe('["gb/adjustris"]'),
    );
  });
});
