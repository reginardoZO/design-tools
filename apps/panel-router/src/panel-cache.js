export const PANEL_CACHE_KEY = "mv-panel-load-router:last-configuration";

const PANEL_CACHE_VERSION = 1;

export function readPanelCache(storage) {
  if (!storage) return null;
  try {
    const cached = JSON.parse(storage.getItem(PANEL_CACHE_KEY));
    if (cached?.version !== PANEL_CACHE_VERSION || !cached.setup || !cached.workspace) return null;
    return cached;
  } catch {
    return null;
  }
}

export function writePanelCache(storage, state) {
  if (!storage) return;
  try {
    storage.setItem(PANEL_CACHE_KEY, JSON.stringify({ version: PANEL_CACHE_VERSION, ...state }));
  } catch {
    // Storage can be unavailable in private browsing or when its quota is full.
  }
}

export function panelSetupFingerprint(setup) {
  return JSON.stringify(setup);
}