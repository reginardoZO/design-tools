/**
 * Node-only disk cache adapter for ng-swdi.js, keyed by "tileKey:year".
 * Closed calendar years never change, so once a tile/year is fetched it is
 * persisted to a committed JSON file and never re-queried.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function createFileCache(filePath) {
  let store = {};
  if (existsSync(filePath)) {
    store = JSON.parse(readFileSync(filePath, "utf8"));
  }
  return {
    async get(key) {
      return store[key] ?? null;
    },
    async set(key, value) {
      store[key] = value;
    },
    save() {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, JSON.stringify(store, null, 2) + "\n");
    },
  };
}
