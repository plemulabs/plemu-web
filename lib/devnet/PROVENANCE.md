# Devnet client provenance

The client builds verified account snapshots, integer quotes and unsigned instruction plans. Signing, consent, persistence and submission are handled by the [browser transaction boundary](../browser-transactions.ts).

## Source bindings

The upstream base is [plemu-skr c5a16e0](https://github.com/plemulabs/plemu-skr/tree/c5a16e0a2745cc3d2fbb90f2e1a9fdb2ae07e3e7).

- [release.json](release.json) comes from the Seeker `GameTokenMarketsV1.json`, active V2 entries in `ApprovedPacks.json`, `WelcomePack.json` and `LibraryRoster.json`. Program/VRF identities follow `LaunchpadCodec.cs` and `RandomPacks.cs`.
- TypeScript files in `generated/accounts`, `generated/types` and `generated/events` copy the upstream compiler-IDL/Codama output. [source-manifest.json](source-manifest.json) pins all 20 files and the original Seeker market fixture. Tests verify these 21 hashes and release identities locally.
- Four `.js` bridges re-export corresponding TypeScript modules for browser resolution. Instruction-data aggregates extract upstream discriminator/codec blocks with consolidated Kit imports.
- V4 reward types are transitive generated dependencies; V4 pools and instructions are inactive.

The 113-byte welcome receipt decoder follows `WelcomeClaim` in upstream `welcome_pack.rs` and Unity's `LaunchpadCodec.WelcomeReceipt`. WelcomeClaim is absent from the generated account directory; receipt initialization uses the program’s prefunded-account path.

Curve/pool arithmetic and lifecycle checks follow Unity's V1 market math/codec/client/trade plan and pack/welcome delivery code. Active V2 progress economics use one buyer payment approval and separate executor funding; delivery is bound to the stored buyer. Buyer-signed claim plans are for existing-draw recovery.

## Fixtures

- [market-sbf.json](__tests__/fixtures/market-sbf.json): executed market-state/event vectors from the Seeker fixture; program SHA-256 `a6c4d3e9206bb4881c6a7cdf206ae123da01237b21caff8b852b7261bff5d1cc`.
- [pack-wire.json](__tests__/fixtures/pack-wire.json): upstream Codama V2 instruction/account vectors.
- [readonly-live-pack.json](__tests__/fixtures/readonly-live-pack.json): captured Devnet responses used for reload/status tests; controlled mutations cover pending/refund/receipt cases.

These fixtures test serialization, state handling and arithmetic. They do not exercise a live wallet transaction or establish deployed-byte equivalence.

## Integration requirements

Use `new DevnetClient({ endpoint? })` with a supported public HTTPS Devnet endpoint, or inject a trusted read-only transport. Reads check the genesis identity and executable program before decoding accounts. Browser RPC URLs must not contain private credentials.

Display the plan's summary and amounts, then call `client.revalidatePlan(plan)` immediately before signing. Convert instructions through `toWeb3Instructions(plan)` at the SDK boundary. Persist and read back exact signed bytes before any RPC exposure, including signed simulation.

The client uses Kit/program-client-core 8.6.0 and buffer 6.0.3. web3.js conversion is isolated to the legacy wallet boundary. It supports the current markets/packs, Seeker-visible mock faucets, partial confirmed history, fee claims, stage sync, observations, funded buybacks and holding proofs. Role and protocol conditions still apply. Legacy auction/DLC flows, public creator publishing, a complete history indexer and dormant V4 remain outside the active client.
