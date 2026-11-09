# Packs, Create and wallet access

Packs mirrors the Seeker layout with Reimagined and GameBoy collection controls, a purple foil pack, possible-pull cartridges and a welcome collection. Artwork uses existing catalog covers and system-specific cartridge shells. The decorative foil uses the retained legacy mark; the app header keeps the primary Plemu wordmark.

The free opening preview is visual only: it never reads a wallet, requests payment, chooses an onchain result or creates a receipt. Keyboard opening and a separate button accompany the horizontal tear gesture; vertical touch gestures keep page scrolling. Replay cycles illustrative catalog covers, not random rewards. Collection changes reset the illustration. Idle foil motion pauses offscreen and in background tabs; system and in-app reduced motion are respected.

Payment approval, eligibility reads, inventory, delivery polling, transaction previews and original-buyer recovery retain their existing implementations. Each collection keeps its own mounted operation panel across selection changes. Recovery displays both pools and the explicit read-only reconnection option. No V2 prices, odds or progress policy changed.

Create presents the planned AI modding studio as coming soon. Generation, community sessions, contributions and publishing are unavailable. Import a game build uses the same browser-library validation as Library and opens the local player; an optional disclosure retains metadata editing and JSON download. Imports and drafts do not publish content or mint tokens.

After connection, the header wallet pill opens a lazy-loaded modal containing the existing wallet balances and faucets. Its inner wallet control retains copy, Explorer, refresh and disconnect actions. Native dialog behavior traps focus and handles Escape; closing returns focus to the invoking pill. Disconnecting closes the modal and aborts its reads. The old `/wallet` route redirects to Library, and wallet links were removed from navigation and the market directory.
