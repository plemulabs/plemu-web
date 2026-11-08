/* Plemu bridge: opaque-origin sandbox; no wallet, storage, ROM upload, or remote runtime. */
(() => {
  const host = new URL(document.currentScript.src).origin;
  const runtimeBase = new URL(".", document.currentScript.src).href;
  // Keep upstream's development-only version check on the pinned local release.
  // No update metadata or source code is downloaded from a CDN at runtime.
  const localFetch = window.fetch.bind(window);
  window.fetch = (input, options) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return localFetch(url === "https://cdn.emulatorjs.org/stable/data/version.json" ? runtimeBase + "data/version.json" : input, options);
  };
  const systems = {snes:"bsnes"};
  let started = false;
  let gameUrl;
  // The isolated player does not keep the device awake or request extra permissions.
  Object.defineProperty(navigator, "wakeLock", { value: undefined, configurable: true });
  const status = document.getElementById("status");
  window.addEventListener("message", event => {
    if (event.source !== parent || event.origin !== host) return;
    if (event.data?.type === "plemu-player-volume" && typeof event.data.muted === "boolean") { window.EJS_emulator?.setVolume?.(event.data.muted ? 0 : .6); return; }
    if (event.data?.type !== "plemu-local-game" || started) return;
    const {bytes,system,title} = event.data;
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength < 16 || bytes.byteLength > 67108864 || !systems[system] || typeof title !== "string") return;
    started = true;
    gameUrl = URL.createObjectURL(new Blob([bytes]));
    window.EJS_player = "#game";
    window.EJS_core = systems[system];
    window.EJS_gameUrl = gameUrl;
    window.EJS_gameName = title.slice(0,120);
    window.EJS_pathtodata = runtimeBase + "data/";
    window.EJS_color = "#c8f46c";
    window.EJS_volume = event.data.muted ? 0 : .6;
    window.EJS_startOnLoaded = true;
    window.EJS_threads = false;
    window.EJS_DEBUG_XX = false;
    window.EJS_cacheConfig = {enabled:false};
    window.EJS_disableDatabases = true;
    Object.defineProperty(window, "indexedDB", {value: undefined, configurable: true});
    Object.defineProperty(window, "localStorage", {value: undefined, configurable: true});
    window.EJS_disableLocalStorage = true;
    window.EJS_language = "en-US";
    window.EJS_disableAutoLang = false;
    window.EJS_Buttons = {netplay:false,cheat:false,cacheManager:false};
    window.EJS_hideSettings = ["retroarch_core"];
    window.EJS_defaultOptions = {"save-state-location":"download", ...(event.data.webgl2 ? {webgl2Enabled:"enabled"} : {})};
    window.EJS_ready = () => { status.hidden = true; parent.postMessage({type:"plemu-player-ready"},host); };
    window.EJS_onGameStart = () => { status.hidden = true; parent.postMessage({type:"plemu-player-started"},host); };
    const loader = document.createElement("script");
    loader.src = runtimeBase + "data/loader.js";
    loader.onerror = () => { status.textContent = "Player could not load. Close it and try again."; parent.postMessage({type:"plemu-player-error"},host); };
    document.body.appendChild(loader);
  });
  parent.postMessage({type:"plemu-player-awaiting-game"},host);
  window.addEventListener("pagehide",()=> { if(gameUrl) URL.revokeObjectURL(gameUrl); });
})();
