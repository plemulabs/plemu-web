import {
  PRIVACY_EVENT,
  readOptionalStorage,
  writeOptionalStorage,
} from "./privacy-preferences";

export const BROWSER_SETTINGS_EVENT = "plemu-browser-settings";
export const BROWSER_SETTINGS_KEY = "plemu-browser-settings-v1";
export type BrowserSettings = Readonly<{
  muted: boolean;
  reducedMotion: boolean;
}>;

let session: BrowserSettings | null = null;
let explicitMotion = false;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Optional records are read only through the existing consent allowlist. */
export function readBrowserSettings(): BrowserSettings {
  if (typeof window === "undefined")
    return { muted: false, reducedMotion: false };
  if (!session) {
    session = { muted: false, reducedMotion: prefersReducedMotion() };
    try {
      const saved: unknown = JSON.parse(
        readOptionalStorage(BROWSER_SETTINGS_KEY) || "null",
      );
      if (
        saved !== null &&
        typeof saved === "object" &&
        "version" in saved &&
        saved.version === 1 &&
        "muted" in saved &&
        typeof saved.muted === "boolean" &&
        "reducedMotion" in saved &&
        typeof saved.reducedMotion === "boolean"
      ) {
        session = {
          muted: saved.muted,
          reducedMotion: saved.reducedMotion,
        };
        explicitMotion = true;
      }
    } catch {
      // Corrupt or unavailable optional records never disable session controls.
    }
  }
  if (!explicitMotion) {
    const reducedMotion = prefersReducedMotion();
    if (session.reducedMotion !== reducedMotion)
      session = { ...session, reducedMotion };
  }
  return session;
}

/** Changes always work in memory; only explicit changes attempt optional saving. */
export function updateBrowserSettings(
  patch: Partial<BrowserSettings>,
): BrowserSettings {
  const previous = readBrowserSettings();
  const next = {
    muted: typeof patch.muted === "boolean" ? patch.muted : previous.muted,
    reducedMotion:
      typeof patch.reducedMotion === "boolean"
        ? patch.reducedMotion
        : previous.reducedMotion,
  };
  if (typeof patch.reducedMotion === "boolean") explicitMotion = true;
  session = next;
  if (typeof window !== "undefined") {
    writeOptionalStorage(
      BROWSER_SETTINGS_KEY,
      JSON.stringify({ version: 1, ...next }),
    );
    window.dispatchEvent(
      new CustomEvent(BROWSER_SETTINGS_EVENT, { detail: next }),
    );
  }
  return next;
}

/** Privacy revocation never rewrites a removed optional record. */
export function subscribeBrowserSettings(
  listener: (settings: BrowserSettings) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const notify = () => listener(readBrowserSettings());
  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  window.addEventListener(BROWSER_SETTINGS_EVENT, notify);
  window.addEventListener(PRIVACY_EVENT, notify);
  media?.addEventListener("change", notify);
  return () => {
    window.removeEventListener(BROWSER_SETTINGS_EVENT, notify);
    window.removeEventListener(PRIVACY_EVENT, notify);
    media?.removeEventListener("change", notify);
  };
}
