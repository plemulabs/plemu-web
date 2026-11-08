"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import documents from "../lib/legal-documents.json";
import {
  choosePersistence,
  hasCurrentTermsReceipt,
  PRIVACY_CHOICE_KEY,
  PRIVACY_EVENT,
  readPrivacyChoice,
  recordTermsReceipt,
  TERMS_DRAFT,
  applyExternalPrivacyDenial,
} from "../lib/privacy-preferences";
import { Dialog } from "./dialog";
import styles from "./privacy-preferences.module.css";

type Preferences = {
  persistence: boolean;
  ready: boolean;
  openPrivacy: () => void;
  requireTerms: () => Promise<boolean>;
};
const Context = createContext<Preferences>({
  persistence: false,
  ready: false,
  openPrivacy: () => {},
  requireTerms: async () => hasCurrentTermsReceipt(),
});
export const usePrivacyPreferences = () => useContext(Context);

export function PrivacyPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [persistence, setPersistence] = useState(false);
  const [ready, setReady] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef<Array<(allowed: boolean) => void>>([]);
  const requireTerms = useCallback(async () => {
    if (hasCurrentTermsReceipt()) return true;
    setChecked(false);
    setTermsOpen(true);
    return new Promise<boolean>((resolve) => pending.current.push(resolve));
  }, []);
  const finishTerms = useCallback((allowed: boolean) => {
    if (allowed) {
      const durable = recordTermsReceipt();
      if (!durable)
        setMessage(
          "Terms choice remembered for this session only. Browser storage is unavailable.",
        );
    }
    setTermsOpen(false);
    pending.current.splice(0).forEach((resolve) => resolve(allowed));
  }, []);

  useEffect(() => {
    const sync = () => {
      const choice = readPrivacyChoice();
      setPersistence(choice?.persistence === true);
      setPrivacyOpen(choice === null);
      setReady(true);
    };
    sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PRIVACY_CHOICE_KEY && event.key !== null) return;
      if (readPrivacyChoice()?.persistence === false)
        applyExternalPrivacyDenial();
      else sync();
    };
    window.addEventListener(PRIVACY_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PRIVACY_EVENT, sync);
      window.removeEventListener("storage", onStorage);
      pending.current.splice(0).forEach((resolve) => resolve(false));
    };
  }, []);

  function choose(allowed: boolean) {
    const stored = choosePersistence(allowed);
    setPersistence(allowed && stored);
    setPrivacyOpen(false);
    if (!stored)
      setMessage(
        "Saving is disabled for this session. If browser records could not be changed or removed, clear Plemu site data in browser settings.",
      );
  }

  return (
    <Context.Provider
      value={{
        persistence,
        ready,
        openPrivacy: () => setPrivacyOpen(true),
        requireTerms,
      }}
    >
      {children}
      {ready && privacyOpen ? (
        <aside className={styles.panel} aria-label="Privacy choices">
          <h2>Save your preferences?</h2>
          <p>
            Choose whether this browser remembers saved games, sound and motion
            preferences, and your selected wallet. Session-only use keeps these
            features available without saving them between visits.
          </p>
          <p>
            We remember this choice and your versioned terms acknowledgment
            separately. <Link href="/privacy">Read the privacy policy</Link>.
          </p>
          <div className={styles.actions}>
            <button onClick={() => choose(false)}>Use session only</button>
            <button onClick={() => choose(true)}>
              Allow saved preferences
            </button>
          </div>
          <p>
            You can change this choice from Privacy choices in the footer.
            Turning saving off removes Plemu’s optional browser records.
          </p>
        </aside>
      ) : null}
      <Dialog
        open={termsOpen}
        onClose={() => finishTerms(false)}
        title="Review the terms"
      >
        <p>
          Read the{" "}
          <Link href="/toc" target="_blank" rel="noopener noreferrer">
            Terms of service, version {documents.version} (opens in a new tab)
          </Link>{" "}
          before requesting a wallet connection or signature. The{" "}
          <Link href="/privacy" target="_blank" rel="noopener noreferrer">
            privacy policy
          </Link>{" "}
          explains processing; it is not a consent checkbox.
        </p>
        {TERMS_DRAFT ? (
          <p>
            These are unpublished review drafts. This acknowledgment is for the
            preview and does not record an effective agreement.
          </p>
        ) : null}
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
          />
          {TERMS_DRAFT
            ? "I have reviewed the draft terms for this preview."
            : "I agree to these Terms of service and meet the applicable legal-capacity and local eligibility rules."}
        </label>
        <div className={styles.actions}>
          <button onClick={() => finishTerms(false)}>Cancel</button>
          <button disabled={!checked} onClick={() => finishTerms(true)}>
            {TERMS_DRAFT
              ? "Acknowledge draft and continue"
              : "Agree to terms and continue"}
          </button>
        </div>
        <p>
          The version and time are recorded locally, without a wallet signature
          or identity check. Clearing site data removes the saved record.
        </p>
      </Dialog>
      {message ? (
        <p className={styles.message} role="status">
          {message}
          <button onClick={() => setMessage("")}>Dismiss</button>
        </p>
      ) : null}
    </Context.Provider>
  );
}
