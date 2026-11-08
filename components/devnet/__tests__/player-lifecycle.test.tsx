import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  game: {
    id: "gb/test",
    slug: "gb-test",
    title: "Test game",
    system: "gb",
    author: "Test creator",
    cover: "/cover.png",
    rom: "/game.gb",
    size: 16,
    sha256: "00".repeat(32),
    description: "Test",
    controls: "Buttons",
  },
}));
vi.mock("../library-provider", () => ({
  useBrowserLibrary: () => ({
    games: [
      state.game,
      {
        ...state.game,
        id: "gb/second",
        slug: "gb-second",
        title: "Second game",
      },
    ],
    favorites: [],
    toggleFavorite: vi.fn(),
    removeImport: vi.fn(),
  }),
  systemNames: { gb: "Game Boy" },
}));
import { BrowserPlayer } from "../player";
beforeEach(() => {
  vi.stubGlobal("crypto", {
    subtle: { digest: vi.fn(async () => new ArrayBuffer(32)) },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
describe("player download lifecycle", () => {
  it("isolates navigation from a late old download and keeps the new start locked", async () => {
    const old = deferred<Response>();
    const current = deferred<Response>();
    const fetch = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    vi.stubGlobal("fetch", fetch);
    const view = render(<BrowserPlayer slug="gb-test" />);
    fireEvent.click(screen.getByRole("button", { name: "▶ Start playing" }));
    const oldSignal = fetch.mock.calls[0][1].signal as AbortSignal;
    view.rerender(<BrowserPlayer slug="gb-second" />);
    expect(oldSignal.aborted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "▶ Start playing" }));
    await act(async () => old.resolve(new Response(new Uint8Array(16))));
    const checking = screen.getByRole("button", { name: "Checking game…" });
    expect((checking as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(checking);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(document.querySelector("iframe")).toBeNull();
    await act(async () => current.resolve(new Response(new Uint8Array(16))));
    expect(document.querySelector("iframe")?.title).toBe("Play Second game");
  });
  it("does not let an abandoned Activity lifecycle unlock a new request", async () => {
    const old = deferred<Response>();
    const current = deferred<Response>();
    const fetch = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    vi.stubGlobal("fetch", fetch);
    const ui = (mode: "visible" | "hidden") => (
      <React.Activity mode={mode}>
        <BrowserPlayer slug="gb-test" />
      </React.Activity>
    );
    const view = render(ui("visible"));
    fireEvent.click(screen.getByRole("button", { name: "▶ Start playing" }));
    view.rerender(ui("hidden"));
    expect((fetch.mock.calls[0][1].signal as AbortSignal).aborted).toBe(true);
    view.rerender(ui("visible"));
    fireEvent.click(screen.getByRole("button", { name: "▶ Start playing" }));
    await act(async () => old.resolve(new Response(new Uint8Array(16))));
    const checking = screen.getByRole("button", { name: "Checking game…" });
    expect((checking as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector("iframe")).toBeNull();
    await act(async () => current.resolve(new Response(new Uint8Array(16))));
    expect(document.querySelector("iframe")?.title).toBe("Play Test game");
  });
  it("starts one download for repeated input and aborts when leaving", async () => {
    const pending = deferred<Response>();
    const fetch = vi.fn().mockReturnValue(pending.promise);
    vi.stubGlobal("fetch", fetch);
    const view = render(<BrowserPlayer slug="gb-test" />);
    const start = screen.getByRole("button", { name: "▶ Start playing" });
    fireEvent.click(start);
    fireEvent.click(start);
    expect(fetch).toHaveBeenCalledOnce();
    expect((start as HTMLButtonElement).disabled).toBe(true);
    const signal = fetch.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(new Response(new Uint8Array(16))));
    expect(document.querySelector("iframe")).toBeNull();
  });
  it("rejects oversized downloads before opening the sandbox and allows retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(new Uint8Array(17)))
        .mockResolvedValueOnce(new Response(new Uint8Array(16))),
    );
    render(<BrowserPlayer slug="gb-test" />);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "▶ Start playing" })),
    );
    expect(screen.getByRole("status").textContent).toMatch(/bounded/);
    expect(document.querySelector("iframe")).toBeNull();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "▶ Start playing" })),
    );
    expect(document.querySelector("iframe")?.getAttribute("sandbox")).toBe(
      "allow-scripts allow-downloads allow-pointer-lock",
    );
    fireEvent.click(screen.getByRole("button", { name: "Stop player" }));
    expect(document.querySelector("iframe")).toBeNull();
  });
});
