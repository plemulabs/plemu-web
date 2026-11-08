# Wallet provider

Adapted from `@solana/wallet-adapter-react` 0.15.40 under [Apache-2.0](LICENSE). [Upstream source](https://github.com/anza-xyz/wallet-adapter/tree/master/packages/core/react/src).

Plemu's changes:

- Imports use public package exports.
- Selected-wallet persistence uses the consent-controlled optional key; mobile authorization remains in memory.
- Fresh authorization and signing require a versioned Terms acknowledgment and account/provider rechecks.
- The provider tree remains mounted across privacy changes. Auto-connect defaults off.
- Explicit existing-draw recovery reconnects are read-only. Claim/refund signing validates the stored buyer and current draw before using the recovery adapter path.

Terms receipts are local UI acknowledgments. Optional storage choices are separate and do not disable wallet use. The Devnet transaction UI uses the shared exact-wire recovery journal and wallet-scoped Web Lock.

[wallet-adapter-local.css](../../components/wallet-adapter-local.css) is based on `@solana/wallet-adapter-react-ui` 0.9.40. Its external Google Fonts import is removed because DM Sans is self-hosted. The [upstream license](../../components/wallet-adapter-LICENSE) is retained.
