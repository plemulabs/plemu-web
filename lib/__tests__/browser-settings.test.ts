import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CHOICE = "plemu-privacy-choice-v1";
const KEY = "plemu-browser-settings-v1";
let motion = false;
let motionListener: (() => void) | null;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  motion = false;
  motionListener = null;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: motion,
      addEventListener: (_: string, listener: () => void) => {
        motionListener = listener;
      },
      removeEventListener: () => {
        motionListener = null;
      },
    })),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function allow() {
  localStorage.setItem(
    CHOICE,
    JSON.stringify({
      version: 1,
      persistence: true,
      recordedAt: new Date().toISOString(),
    }),
  );
}

describe("browser settings consent and session boundaries", () => {
  it("does not read or write optional records before opt-in", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, muted: true, reducedMotion: true }),
    );
    const reads = vi.spyOn(Storage.prototype, "getItem");
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const settings = await import("../browser-settings");
    expect(settings.readBrowserSettings()).toEqual({
      muted: false,
      reducedMotion: false,
    });
    settings.updateBrowserSettings({ muted: true });
    expect(settings.readBrowserSettings().muted).toBe(true);
    expect(reads.mock.calls.some(([key]) => key === KEY)).toBe(false);
    expect(writes.mock.calls.some(([key]) => key === KEY)).toBe(false);
  });

  it("restores only a versioned valid record after opt-in", async () => {
    allow();
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, muted: true, reducedMotion: false }),
    );
    motion = true;
    const settings = await import("../browser-settings");
    expect(settings.readBrowserSettings()).toEqual({
      muted: true,
      reducedMotion: false,
    });
  });

  it.each([
    "invalid json",
    "null",
    "[]",
    JSON.stringify({ version: 0, muted: true, reducedMotion: true }),
    JSON.stringify({ version: 1, muted: "yes", reducedMotion: true }),
  ])(
    "ignores invalid record %s and respects the device default",
    async (value) => {
      allow();
      motion = true;
      localStorage.setItem(KEY, value);
      const settings = await import("../browser-settings");
      expect(settings.readBrowserSettings()).toEqual({
        muted: false,
        reducedMotion: true,
      });
    },
  );

  it("retains session edits when consent changes without silently migrating them", async () => {
    const settings = await import("../browser-settings");
    const privacy = await import("../privacy-preferences");
    settings.updateBrowserSettings({ muted: true });
    privacy.choosePersistence(true);
    expect(settings.readBrowserSettings().muted).toBe(true);
    expect(localStorage.getItem(KEY)).toBe(null);
    settings.updateBrowserSettings({ reducedMotion: true });
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({
      version: 1,
      muted: true,
      reducedMotion: true,
    });
  });

  it("does not repopulate optional records after revocation, while session controls keep working", async () => {
    allow();
    const settings = await import("../browser-settings");
    const privacy = await import("../privacy-preferences");
    settings.updateBrowserSettings({ muted: true });
    const changed = vi.fn();
    const stop = settings.subscribeBrowserSettings(changed);
    privacy.choosePersistence(false);
    expect(localStorage.getItem(KEY)).toBe(null);
    settings.updateBrowserSettings({ reducedMotion: true });
    expect(settings.readBrowserSettings()).toEqual({
      muted: true,
      reducedMotion: true,
    });
    expect(localStorage.getItem(KEY)).toBe(null);
    expect(changed).toHaveBeenCalled();
    stop();
  });

  it("keeps settings and emits a manual-change event when storage throws", async () => {
    allow();
    const settings = await import("../browser-settings");
    settings.readBrowserSettings();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    const listener = vi.fn();
    window.addEventListener(settings.BROWSER_SETTINGS_EVENT, listener);
    settings.updateBrowserSettings({ muted: true });
    expect(settings.readBrowserSettings().muted).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(settings.BROWSER_SETTINGS_EVENT, listener);
  });

  it("follows device motion changes until an explicit choice, and cleans up subscriptions", async () => {
    const settings = await import("../browser-settings");
    expect(settings.readBrowserSettings().reducedMotion).toBe(false);
    const listener = vi.fn();
    const stop = settings.subscribeBrowserSettings(listener);
    motion = true;
    motionListener?.();
    expect(settings.readBrowserSettings().reducedMotion).toBe(true);
    settings.updateBrowserSettings({ reducedMotion: false });
    motionListener?.();
    expect(settings.readBrowserSettings().reducedMotion).toBe(false);
    stop();
    listener.mockClear();
    settings.updateBrowserSettings({ muted: true });
    expect(listener).not.toHaveBeenCalled();
  });
});
