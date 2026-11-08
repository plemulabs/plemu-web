import documents from "./legal-documents.json";

export const PRIVACY_CHOICE_KEY = "plemu-privacy-choice-v1";
export const TERMS_RECEIPT_KEY = "plemu-terms-receipt-v1";
export const PRIVACY_EVENT = "plemu-privacy-change";
export const TERMS_DRAFT = !documents.effectiveDate;
export const TERMS_VERSION = `${documents.version}:${documents.effectiveDate || "draft"}`;
export const OPTIONAL_KEYS = [
  "plemu-browser-library-v1",
  "plemu-browser-settings-v1",
  "plemu-product-v1",
  "plemu-creator-drafts",
  "plemu-creator-profile",
  "plemu-creator-concept-v1",
  "plemu-creator-pack-v1",
  "plemu-creator-mod-v1",
  "plemu-creator-lab-v1",
  "plemu-wallet-name-v1",
] as const;

type PrivacyChoice = { version: 1; persistence: boolean; recordedAt: string };
type TermsReceipt = { version: string; recordedAt: string };
let sessionReceipt: TermsReceipt | null = null;
let sessionOnly = false;
let privacyChannel: BroadcastChannel | null = null;

function clearOptionalRecords(): boolean {
  let cleared = true;
  for (const key of OPTIONAL_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      cleared = false;
    }
  }
  return cleared;
}

export function applyExternalPrivacyDenial(): void {
  sessionOnly = true;
  clearOptionalRecords();
  window.dispatchEvent(new Event(PRIVACY_EVENT));
}

function channel(): BroadcastChannel | null {
  if (
    !privacyChannel &&
    typeof window !== "undefined" &&
    typeof window.BroadcastChannel !== "undefined"
  ) {
    try {
      privacyChannel = new window.BroadcastChannel("plemu-privacy-v1");
      privacyChannel.onmessage = (event) => {
        if (event.data?.persistence !== false) return;
        applyExternalPrivacyDenial();
      };
    } catch {
      /* Storage events still synchronize successful persistent choices. */
    }
  }
  return privacyChannel;
}

function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    Date.parse(value) <= Date.now() + 60000
  );
}

export function readPrivacyChoice(): PrivacyChoice | null {
  channel();
  if (sessionOnly)
    return {
      version: 1,
      persistence: false,
      recordedAt: new Date().toISOString(),
    };
  try {
    const choice = JSON.parse(
      localStorage.getItem(PRIVACY_CHOICE_KEY) || "null",
    );
    return choice?.version === 1 &&
      typeof choice.persistence === "boolean" &&
      validDate(choice.recordedAt)
      ? choice
      : null;
  } catch {
    return null;
  }
}

function optionalKey(key: string) {
  return (OPTIONAL_KEYS as readonly string[]).includes(key);
}

export function readOptionalStorage(key: string): string | null {
  if (!optionalKey(key) || readPrivacyChoice()?.persistence !== true)
    return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeOptionalStorage(key: string, value: string): boolean {
  if (!optionalKey(key) || readPrivacyChoice()?.persistence !== true)
    return false;
  try {
    localStorage.setItem(key, value);
    if (readPrivacyChoice()?.persistence !== true) {
      localStorage.removeItem(key);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function choosePersistence(persistence: boolean): boolean {
  sessionOnly = !persistence;
  let stored = false;
  try {
    localStorage.setItem(
      PRIVACY_CHOICE_KEY,
      JSON.stringify({
        version: 1,
        persistence,
        recordedAt: new Date().toISOString(),
      }),
    );
    stored = true;
  } catch {
    if (!persistence) {
      try {
        localStorage.removeItem(PRIVACY_CHOICE_KEY);
      } catch {
        /* A live-tab denial is also broadcast below. */
      }
    }
  }
  const cleared = persistence || clearOptionalRecords();
  sessionOnly = !stored;
  if (!persistence) channel()?.postMessage({ persistence: false });
  window.dispatchEvent(new Event(PRIVACY_EVENT));
  return stored && cleared;
}

export function hasCurrentTermsReceipt(): boolean {
  if (sessionReceipt?.version === TERMS_VERSION) return true;
  try {
    const receipt = JSON.parse(
      localStorage.getItem(TERMS_RECEIPT_KEY) || "null",
    );
    return receipt?.version === TERMS_VERSION && validDate(receipt.recordedAt);
  } catch {
    return false;
  }
}

export function recordTermsReceipt(): boolean {
  const receipt = {
    version: TERMS_VERSION,
    recordedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(TERMS_RECEIPT_KEY, JSON.stringify(receipt));
    sessionReceipt = null;
    return true;
  } catch {
    sessionReceipt = receipt;
    return false;
  }
}
