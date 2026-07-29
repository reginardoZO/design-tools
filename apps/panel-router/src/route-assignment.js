const METRIC_EPSILON = 1e-9;

function isBetterPlan(candidate, current) {
  if (!current) return true;
  if (candidate.length < current.length - METRIC_EPSILON) return true;
  if (candidate.length > current.length + METRIC_EPSILON) return false;
  if (candidate.bends !== current.bends) return candidate.bends < current.bends;
  for (let index = 0; index < candidate.columns.length; index++) {
    if (candidate.columns[index] !== current.columns[index]) {
      return candidate.columns[index] < current.columns[index];
    }
  }
  return false;
}

export function countOrderInversions(connections) {
  let inversions = 0;
  for (let i = 0; i < connections.length; i++) {
    for (let j = i + 1; j < connections.length; j++) {
      const sourceDelta = connections[i].sourceY - connections[j].sourceY;
      const destinationDelta = connections[i].destinationY - connections[j].destinationY;
      if (sourceDelta * destinationDelta < 0) inversions++;
    }
  }
  return inversions;
}

export function countRouteBends(points) {
  let bends = 0;
  let previousDirection = null;
  for (let index = 1; index < points.length; index++) {
    const dx = points[index][0] - points[index - 1][0];
    const dy = points[index][1] - points[index - 1][1];
    if (Math.abs(dx) < METRIC_EPSILON && Math.abs(dy) < METRIC_EPSILON) continue;
    if (previousDirection && Math.abs(previousDirection.dx * dy - previousDirection.dy * dx) > METRIC_EPSILON) {
      bends++;
    }
    previousDirection = { dx, dy };
  }
  return bends;
}

export function optimizeOrderedAssignment(loads, columns, routeMetric) {
  if (loads.length > columns.length) throw new Error("Not enough columns for the requested loads.");

  const orderedLoads = loads
    .map((load, originalIndex) => ({ load, originalIndex }))
    .sort((a, b) => a.load.y - b.load.y || a.originalIndex - b.originalIndex)
    .map((item) => item.load);
  const orderedColumns = [...columns].sort((a, b) => a - b);
  const plans = Array.from(
    { length: orderedLoads.length + 1 },
    () => Array(orderedColumns.length + 1).fill(null),
  );

  for (let columnCount = 0; columnCount <= orderedColumns.length; columnCount++) {
    plans[0][columnCount] = { length: 0, bends: 0, columns: [] };
  }

  for (let loadCount = 1; loadCount <= orderedLoads.length; loadCount++) {
    for (let columnCount = 1; columnCount <= orderedColumns.length; columnCount++) {
      let best = plans[loadCount][columnCount - 1];
      const previous = plans[loadCount - 1][columnCount - 1];
      if (previous) {
        const metric = routeMetric(orderedLoads[loadCount - 1], orderedColumns[columnCount - 1]);
        const candidate = {
          length: previous.length + metric.length,
          bends: previous.bends + metric.bends,
          columns: [...previous.columns, orderedColumns[columnCount - 1]],
        };
        if (isBetterPlan(candidate, best)) best = candidate;
      }
      plans[loadCount][columnCount] = best;
    }
  }

  const best = plans[orderedLoads.length][orderedColumns.length];
  return orderedLoads.map((load, index) => ({ load, col: best.columns[index] }));
}