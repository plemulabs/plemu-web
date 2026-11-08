# Experimental Plemu browser SNES runtime

This component is an isolated, self-hosted bsnes player. It uses EmulatorJS 4.3.0-pre frontend source/release and captured official nightly bsnes artifacts with the Asyncify fix. Both normal and legacy core files are pinned in manifest.json. No Snes9x artifact is included.

The upstream bundled bsnes license is GPL-3.0-or-later, with notices for libco/nall/ruby/hiro; the frontend is GPLv3. See LICENSE and notices/. Plemu terms preserve those rights.

Sources:
- https://github.com/EmulatorJS/EmulatorJS/releases/tag/v4.3.0-pre
- https://github.com/EmulatorJS/bsnes-libretro/tree/4b344745e3878e7c0675a60c624582935524b8f7
- https://github.com/EmulatorJS/RetroArch/commit/d907a125ee76e02a21d89003c140fd0b72886e90
- https://github.com/EmulatorJS/build/tree/7f4d2d7354d7b25766bf5229f8a5c4b121515a68

The last three revisions are source-history candidates from before the recorded core build. They are not an independently reproduced source-to-binary attestation. The binary does not embed all source/compiler revisions; a full corresponding-source/toolchain review or reproducible rebuild remains required before public redistribution. The release packet retains source snapshots and detailed internal verification records.

The player accepts only selected game bytes from its exact parent origin, in an opaque-origin sandbox. Wallet access, storage caches, multiplayer, automatic source updates and arbitrary core switching are disabled. Upstream's local-development version check resolves to the pinned local version file. Frame CSP permits self-hosted/blob assets and blocks external connections.

Desktop and mobile-sized Chromium rendered the exact curated Helheim artifact and advanced beyond the title; this is not a complete playthrough, real-device certification, or a guarantee that browser and Seeker saves are compatible.
