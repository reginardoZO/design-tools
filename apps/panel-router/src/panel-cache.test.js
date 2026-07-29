import test from "node:test";
import assert from "node:assert/strict";
import {
  PANEL_CACHE_KEY,
  panelSetupFingerprint,
  readPanelCache,
  writePanelCache,
} from "./panel-cache.js";

function createStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem: (key) => key === PANEL_CACHE_KEY ? value : null,
    setItem: (key, nextValue) => {
      if (key === PANEL_CACHE_KEY) value = nextValue;
    },
  };
}

test("round-trips the latest panel state through browser storage", () => {
  const storage = createStorage();
  const state = {
    step: "canvas",
    setup: { widthIn: 141.73, nCols: 8 },
    workspace: { loads: [{ id: 1, name: "MCC" }], routes: null },
  };

  writePanelCache(storage, state);

  assert.deepEqual(readPanelCache(storage), { version: 1, ...state });
});

test("ignores missing, corrupt, or obsolete cache entries", () => {
  assert.equal(readPanelCache(createStorage()), null);
  assert.equal(readPanelCache(createStorage("not-json")), null);
  assert.equal(readPanelCache(createStorage(JSON.stringify({ version: 0, setup: {}, workspace: {} }))), null);
});

test("uses the effective setup values to detect panel changes", () => {
  const setup = { widthIn: 141.73, nCols: 8, wall: "bottom" };

  assert.equal(panelSetupFingerprint(setup), panelSetupFingerprint({ ...setup }));
  assert.notEqual(panelSetupFingerprint(setup), panelSetupFingerprint({ ...setup, nCols: 9 }));
});