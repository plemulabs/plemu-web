// Adapted from @solana/wallet-adapter-react 0.15.40 (Apache-2.0); see LICENSE and README.md.
import {
  createDefaultAddressSelector,
  type AuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
  SolanaMobileWalletAdapter,
  SolanaMobileWalletAdapterWalletName,
} from "@solana-mobile/wallet-adapter-mobile";
import {
  type Adapter,
  type WalletError,
  type WalletName,
} from "@solana/wallet-adapter-base";
import { useStandardWalletAdapters } from "@solana/wallet-standard-wallet-adapter-react";
import React, {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import getEnvironment, { Environment } from "./getEnvironment";
import getInferredClusterFromEndpoint from "./getInferredClusterFromEndpoint";
import { useConnection } from "@solana/wallet-adapter-react";
import { usePrivacyPreferences } from "../../components/privacy-preferences";
import {
  readOptionalStorage,
  writeOptionalStorage,
  hasCurrentTermsReceipt,
} from "../../lib/privacy-preferences";
import { WalletProviderBase } from "./WalletProviderBase";

export interface WalletProviderProps {
  children: ReactNode;
  wallets: Adapter[];
  autoConnect?: boolean | ((adapter: Adapter) => Promise<boolean>);
  localStorageKey?: string;
  onError?: (error: WalletError, adapter?: Adapter) => void;
}

let _userAgent: string | null;
function getUserAgent() {
  if (_userAgent === undefined) {
    _userAgent = globalThis.navigator?.userAgent ?? null;
  }
  return _userAgent;
}

function getIsMobile(adapters: Adapter[]) {
  const userAgentString = getUserAgent();
  return (
    getEnvironment({ adapters, userAgentString }) === Environment.MOBILE_WEB
  );
}

function getUriForAppIdentity() {
  const location = globalThis.location;
  if (!location) return;
  return `${location.protocol}//${location.host}`;
}

export function WalletProvider({
  children,
  wallets: adapters,
  autoConnect,
  onError,
}: WalletProviderProps) {
  const { connection } = useConnection();
  const adaptersWithStandardAdapters = useStandardWalletAdapters(adapters);
  const mobileWalletAdapter = useMemo(() => {
    if (!getIsMobile(adaptersWithStandardAdapters)) {
      return null;
    }
    const existingMobileWalletAdapter = adaptersWithStandardAdapters.find(
      (adapter) => adapter.name === SolanaMobileWalletAdapterWalletName,
    );
    if (existingMobileWalletAdapter) {
      return existingMobileWalletAdapter;
    }
    return new SolanaMobileWalletAdapter({
      addressSelector: createDefaultAddressSelector(),
      appIdentity: {
        uri: getUriForAppIdentity(),
      },
      authorizationResultCache: memoryAuthorizationCache(),
      cluster: getInferredClusterFromEndpoint(connection?.rpcEndpoint),
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
    });
  }, [adaptersWithStandardAdapters, connection?.rpcEndpoint]);
  const adaptersWithMobileWalletAdapter = useMemo(() => {
    if (
      mobileWalletAdapter == null ||
      adaptersWithStandardAdapters.indexOf(mobileWalletAdapter) !== -1
    ) {
      return adaptersWithStandardAdapters;
    }
    return [mobileWalletAdapter, ...adaptersWithStandardAdapters];
  }, [adaptersWithStandardAdapters, mobileWalletAdapter]);
  const { persistence, ready } = usePrivacyPreferences();
  const [walletName, setName] = useState<WalletName | null>(null);
  useEffect(() => {
    if (!ready || !persistence) return;
    const saved = readOptionalStorage("plemu-wallet-name-v1");
    if (saved) {
      try {
        const name: unknown = JSON.parse(saved);
        if (typeof name === "string") setName(name as WalletName);
      } catch {
        /* Ignore invalid optional preferences. */
      }
    }
  }, [persistence, ready]);
  const setWalletName = useCallback((name: WalletName | null) => {
    setName(name);
    writeOptionalStorage("plemu-wallet-name-v1", JSON.stringify(name));
  }, []);
  const adapter = useMemo(
    () =>
      adaptersWithMobileWalletAdapter.find((a) => a.name === walletName) ??
      null,
    [adaptersWithMobileWalletAdapter, walletName],
  );
  const changeWallet = useCallback(
    (nextWalletName: WalletName<string> | null) => {
      if (walletName === nextWalletName) return;
      if (
        adapter &&
        // Selecting a wallet other than the mobile wallet adapter is not
        // sufficient reason to call `disconnect` on the mobile wallet adapter.
        // Calling `disconnect` on the mobile wallet adapter causes the entire
        // authorization store to be wiped.
        adapter.name !== SolanaMobileWalletAdapterWalletName
      ) {
        adapter.disconnect();
      }
      setWalletName(nextWalletName);
    },
    [adapter, setWalletName, walletName],
  );
  useEffect(() => {
    if (!adapter) return;
    function handleDisconnect() {
      if (isUnloadingRef.current) return;
      setWalletName(null);
    }
    adapter.on("disconnect", handleDisconnect);
    return () => {
      adapter.off("disconnect", handleDisconnect);
    };
  }, [adapter, adaptersWithStandardAdapters, setWalletName, walletName]);
  const hasUserSelectedAWallet = useRef(false);
  const handleAutoConnectRequest = useMemo(() => {
    if (!autoConnect || !adapter) return;
    return async () => {
      if (!hasCurrentTermsReceipt()) return;
      // If autoConnect is true or returns true, use the default autoConnect behavior.
      if (autoConnect === true || (await autoConnect(adapter))) {
        if (hasUserSelectedAWallet.current) {
          await adapter.connect();
        } else {
          await adapter.autoConnect();
        }
      }
    };
  }, [autoConnect, adapter]);
  const isUnloadingRef = useRef(false);
  useEffect(() => {
    if (
      walletName === SolanaMobileWalletAdapterWalletName &&
      getIsMobile(adaptersWithStandardAdapters)
    ) {
      isUnloadingRef.current = false;
      return;
    }
    function handleBeforeUnload() {
      isUnloadingRef.current = true;
    }
    /**
     * Some wallets fire disconnection events when the window unloads. Since there's no way to
     * distinguish between a disconnection event received because a user initiated it, and one
     * that was received because they've closed the window, we have to track window unload
     * events themselves. Downstream components use this information to decide whether to act
     * upon or drop wallet events and errors.
     */
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [adaptersWithStandardAdapters, walletName]);
  const handleConnectError = useCallback(() => {
    if (adapter) {
      // If any error happens while connecting, unset the adapter.
      changeWallet(null);
    }
  }, [adapter, changeWallet]);
  const selectWallet = useCallback(
    (walletName: WalletName | null) => {
      hasUserSelectedAWallet.current = true;
      changeWallet(walletName);
    },
    [changeWallet],
  );
  return (
    <WalletProviderBase
      wallets={adaptersWithMobileWalletAdapter}
      adapter={adapter}
      isUnloadingRef={isUnloadingRef}
      onAutoConnectRequest={handleAutoConnectRequest}
      onConnectError={handleConnectError}
      onError={onError}
      onSelectWallet={selectWallet}
    >
      {children}
    </WalletProviderBase>
  );
}

function memoryAuthorizationCache(): AuthorizationResultCache {
  let result: Awaited<ReturnType<AuthorizationResultCache["get"]>>;
  return {
    async get() {
      return result;
    },
    async set(next) {
      result = next;
    },
    async clear() {
      result = undefined;
    },
  };
}
