import test from "node:test";
import assert from "node:assert/strict";
import { countOrderInversions, optimizeOrderedAssignment } from "./route-assignment.js";

test("orders Bus A loads by source height and removes the current inversions", () => {
  const loads = [
    { name: "MCC A", bus: "A", y: 280 },
    { name: "SCR A", bus: "A", y: 443 },
    { name: "MAC A", bus: "A", y: 560 },
    { name: "RECY A", bus: "A", y: 620 },
    { name: "N2 A", bus: "A", y: 680 },
  ];
  const availableColumns = [4, 5, 6, 7, 8];
  const optimized = optimizeOrderedAssignment(loads, availableColumns, (load, col) => ({
    length: Math.abs(load.y - col * 60),
    bends: 2,
  }));
  const optimizedPosition = new Map(optimized.map(({ load, col }) => [load.name, col + 1]));

  assert.deepEqual(Object.fromEntries(optimizedPosition), {
    "MCC A": 5,
    "SCR A": 6,
    "MAC A": 7,
    "RECY A": 8,
    "N2 A": 9,
  });
  assert.ok(optimizedPosition.get("SCR A") < optimizedPosition.get("MAC A"));
  assert.ok(optimizedPosition.get("SCR A") < optimizedPosition.get("RECY A"));

  const currentPosition = new Map([
    ["MCC A", 5],
    ["SCR A", 8],
    ["MAC A", 6],
    ["RECY A", 7],
    ["N2 A", 9],
  ]);
  const crossingsFor = (positions) => countOrderInversions(loads.map((load) => ({
    sourceY: load.y,
    destinationY: positions.get(load.name),
  })));

  assert.equal(crossingsFor(currentPosition), 2);
  assert.equal(crossingsFor(optimizedPosition), 0);
  assert.ok(crossingsFor(optimizedPosition) < crossingsFor(currentPosition));
});