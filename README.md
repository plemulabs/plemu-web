# Plemu Play

Solana Devnet web application for the Plemu game library, token markets and packs. The public landing lives in [plemu-lp](https://github.com/plemulabs/plemu-lp).

## Development

Use Node 22.18 or newer:

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run format:check
npm run build
npm run start
```

Use HTTPS or secure localhost for wallet and Web Crypto features. The default public Devnet RPC may rate-limit. The application reports read failures rather than substituting sample balances or quotes.

## Features

- Library and Discover use the 27-title Seeker roster, with source hashes, creator credits, filters, favorites and local imports. Imported files stay in the current tab and require reimport after reload.
- Browser players support GB/GBC, NES and GBA, plus an experimental SNES runtime. Save files are downloaded and imported explicitly.
- Five native-SOL V1 markets provide integer buy/sell quotes, slippage controls, bounded confirmed history and role-gated protocol operations.
- Welcome and two active V2 progress pools support purchase, delivery and recovery. Reward counts use 50%/35%/15% odds for one/two/three entries. Selection prioritizes missing entries at request time, then fills from the remaining pool.
- Paid packs use one buyer payment approval. A separate executor delivers to the stored buyer; manual claim/refund paths recover an existing draw.
- Wallet balances cover 21 supported assets. Three mock-token faucets are available alongside an official native-SOL faucet link. Mock SOL cannot pay network fees.
- Create edits local metadata drafts and exports JSON. Public publishing is unavailable.
- Settings includes sound/motion preferences, optional storage, credits and legal documents.

Active UI is in [components/devnet](components/devnet/). Earlier prototype modules remain for compatibility tests; their old destinations redirect to current routes. V4 pools are inactive. Devnet tokens have no monetary value.

## Transaction handling

New actions require a current Terms acknowledgment, fresh protocol state, an amount preview and wallet approval. The signing boundary checks Devnet genesis, account identities, wallet/provider changes, message integrity and fee balance.

A wallet-scoped Web Lock prevents overlapping approvals. Exact signed bytes are persisted and read back before RPC submission or signed simulation. Confirmation checks and resubmission reuse that wire and signature. Explicit recovery reconnects are read-only; existing-draw recovery uses fresh original-buyer validation and does not require accepting new terms.

See [protocol provenance](lib/devnet/PROVENANCE.md) and the [transaction boundary](lib/browser-transactions.ts).

Fresh snapshots read independent account and rent data concurrently after network and program checks. Reads that depend on a confirmed slot remain ordered; chain state is not cached. Leaving a panel or changing wallets aborts its pending reads, and pack polling waits for the current read to finish.

RPC responses are capped at 2,000,000 decoded bytes while streaming. Game downloads are capped at the catalog's expected size, then checked against their SHA-256 before opening the player. Repeated start input shares one download; navigation aborts it and discards late results.

## Players and content

Players run in opaque-origin iframes with self-hosted assets, storage caches and multiplayer disabled. They receive selected game bytes and have no wallet interface. Browser and Seeker performance/save formats can differ.

GB/GBC, NES and GBA use EmulatorJS 4.2.3. SNES uses a pinned 4.3-pre frontend and bsnes nightly components. Both runtime manifests record unresolved corresponding-source/compiler provenance; matching-source and license fulfillment must be completed before public redistribution. See [stable player notices](public/emulator/NOTICE.txt) and [SNES integration](public/emulator-snes/INTEGRATION.md).

Game builds have separate distribution terms. In particular, the [Goodboy Galaxy record](public/seeker/gba-goodboy-galaxy/license-evidence.md) identifies a commercial build, and [Snek credits](public/seeker/notices/snek-gba/PROVENANCE.md) identify noncommercial audio and an incomplete code-license grant. These records require resolution before publishing the bundled assets. The catalog's presence is not a blanket public-distribution permission.

`npm run check:assets` verifies catalog consistency, ROM hashes, cover/evidence files and runtime manifests before each build. Artwork sources and transformations are recorded in [presentation credits](public/seeker/notices/PRESENTATION-ART.md).

## Legal documents

[lib/legal-documents.json](lib/legal-documents.json) is the canonical policy source. `/toc` and `/privacy` render the full documents and link to the website. Optional storage defaults off; Terms acknowledgment and necessary transaction recovery use separate records.

After committing a policy revision, update the landing export from its checkout:

```sh
node scripts/sync-legal.mjs /path/to/plemu-web/lib/legal-documents.json
```

Each project builds independently. Native offline copies are maintained in [plemu-skr](https://github.com/plemulabs/plemu-skr). Policies remain review drafts pending counsel and confirmation of contact/provider facts.

## Hosting

For `devnet.plemu.xyz`, use repository root `.`, the Next.js framework, `npm ci`, `npm run build` and framework-default output. Retain the configured player headers and redirects. The default public Devnet endpoint requires no private environment variables. Verify wallet behavior and RPC access on the deployed HTTPS origin.

Application responses restrict framing to the same origin and disable MIME sniffing, external form submissions and embedded objects. Player frames retain their separate resource policy and opaque-origin CORS support. The application policy does not restrict script sources; it is not a complete script-injection defense.
