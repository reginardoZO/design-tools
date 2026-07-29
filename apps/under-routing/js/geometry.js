// geometry.js — coordinate transforms and octilinear (45°) path construction.
//
// The whole app works in "world" units of inches. A panel column is always
// 36 in (3 ft) wide. Rendering maps world → screen via a simple pan/zoom view.

export const IN_PER_FT = 12;
export const COL_WIDTH_IN = 36; // every column is exactly 3 ft wide
export const END_SECTION_WIDTH_IN = 4.156;
export const SQRT2 = Math.SQRT2;

// ---- vector helpers -------------------------------------------------------

export function rotateVec(x, y, deg) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
}

// Transform a point from a panel's local frame into world coordinates.
// Local frame: origin at the panel's front-top corner, +x points into the
// panel depth (toward the wall), +y runs down the column stack.
export function panelLocalToWorld(panel, lx, ly) {
  const [rx, ry] = rotateVec(lx, ly, panel.rotation);
  return [panel.x + rx, panel.y + ry];
}

// Unit vector, in world space, pointing out of the panel front (the side the
// cables exit — away from the wall). In local space that direction is -x.
export function panelFrontDir(panel) {
  return rotateVec(-1, 0, panel.rotation);
}

// The tap point (world) for a given column index of a panel: the middle of
// that column on the front face.
export function columnTapWorld(panel, colIndex) {
  // The first equipment column starts after the leading END SECTION.
  const y = END_SECTION_WIDTH_IN + colIndex * COL_WIDTH_IN + COL_WIDTH_IN / 2;
  return panelLocalToWorld(panel, 0, y);
}

// Panels always have a non-connectable END SECTION at both ends of the
// configured equipment-column lineup.
export function panelLengthIn(panel) {
  return panel.columns.length * COL_WIDTH_IN + END_SECTION_WIDTH_IN * 2;
}

// ---- octilinear routing ---------------------------------------------------

// Build an octilinear polyline (segments at 0/45/90/135°) from a free load
// point to a panel tap, arriving along the panel's front direction.
//
//   load      – [x, y] world
//   tap       – [x, y] world
//   frontDir  – unit vector, world, the tap's outward (exit) direction
//   slack     – how far, in inches, the route runs straight out of the load
//               before it starts its diagonal (the "fan" offset). Larger
//               values push a route's diagonal outward, letting neighbouring
//               routes nest without overlapping.
//
// Returns { points: [[x,y]...], length } with length in inches.
export function octRoute(load, tap, frontDir, slack) {
  // Work in the tap's local frame: tap at origin, +x = frontDir (exit side).
  const ang = Math.atan2(frontDir[1], frontDir[0]);
  const cos = Math.cos(-ang);
  const sin = Math.sin(-ang);
  const toLocal = (p) => {
    const dx = p[0] - tap[0];
    const dy = p[1] - tap[1];
    return [dx * cos - dy * sin, dx * sin + dy * cos];
  };
  const toWorld = (p) => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    return [tap[0] + (p[0] * c - p[1] * s), tap[1] + (p[0] * s + p[1] * c)];
  };

  const L = toLocal(load); // load in tap frame
  const a = L[0]; // horizontal distance from tap to load (front axis)
  const b = L[1]; // perpendicular offset
  const sign = b >= 0 ? 1 : -1;
  const ab = Math.abs(b);

  let local;
  if (a <= 0) {
    // Load is behind the front face (unusual): fall back to a straight line.
    local = [L, [0, 0]];
  } else if (a >= ab) {
    // Horizontal-dominant: run out of the load, one diagonal, run into tap.
    const g = Math.max(0, Math.min(slack, a - ab)); // clamp the fan offset
    const diagStart = [a - g, b];
    const diagEnd = [a - g - ab, 0];
    local = [L, diagStart, diagEnd, [0, 0]];
  } else {
    // Vertical-dominant: a perpendicular run then a diagonal into the tap.
    const diagStart = [a, sign * a];
    local = [L, diagStart, [0, 0]];
  }

  // Drop consecutive duplicate points.
  const cleaned = [];
  for (const p of local) {
    const last = cleaned[cleaned.length - 1];
    if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-6) cleaned.push(p);
  }

  const points = cleaned.map(toWorld);
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return { points, length };
}

// ---- rectangular obstacle avoidance -------------------------------------

const GEOMETRY_EPSILON = 1e-6;

// Replace an octilinear route with its shortest obstacle-free equivalent.
// Foundations are axis-aligned rectangles in world coordinates. Their
// boundaries may be followed, but no route segment may enter their interior.
export function avoidRectangles(points, foundations, clearance = 0) {
  const obstacles = foundations.map((foundation) => ({
    left: foundation.x - clearance,
    top: foundation.y - clearance,
    right: foundation.x + foundation.width + clearance,
    bottom: foundation.y + foundation.height + clearance,
  }));

  if (!polylineHitsRectangles(points, obstacles)) {
    return { points, length: polylineLength(points), blocked: false };
  }

  const anchors = [...points];
  for (const obstacle of obstacles) {
    anchors.push(
      [obstacle.left, obstacle.top],
      [obstacle.right, obstacle.top],
      [obstacle.right, obstacle.bottom],
      [obstacle.left, obstacle.bottom]
    );
  }

  const candidates = buildOctilinearCandidates(anchors, obstacles);
  const graph = buildVisibilityGraph(candidates, obstacles);
  const start = findPointIndex(candidates, points[0]);
  const end = findPointIndex(candidates, points[points.length - 1]);
  const routed = shortestPath(graph, start, end);

  if (!routed) {
    return { points, length: polylineLength(points), blocked: true };
  }

  const routedPoints = removeCollinearPoints(routed.map((index) => candidates[index]));
  return { points: routedPoints, length: polylineLength(routedPoints), blocked: false };
}

function polylineHitsRectangles(points, obstacles) {
  for (let index = 1; index < points.length; index++) {
    if (!segmentIsClear(points[index - 1], points[index], obstacles)) return true;
  }
  return false;
}

function segmentIsClear(start, end, obstacles) {
  return obstacles.every((obstacle) => !segmentEntersRectangle(start, end, obstacle));
}

function segmentEntersRectangle(start, end, obstacle) {
  // Shrinking by epsilon makes touching or following the boundary legal.
  const left = obstacle.left + GEOMETRY_EPSILON;
  const right = obstacle.right - GEOMETRY_EPSILON;
  const top = obstacle.top + GEOMETRY_EPSILON;
  const bottom = obstacle.bottom - GEOMETRY_EPSILON;
  if (left >= right || top >= bottom) return false;

  let from = 0;
  let to = 1;
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  for (const [p, q] of [
    [-dx, start[0] - left],
    [dx, right - start[0]],
    [-dy, start[1] - top],
    [dy, bottom - start[1]],
  ]) {
    if (Math.abs(p) < GEOMETRY_EPSILON) {
      if (q < 0) return false;
      continue;
    }
    const ratio = q / p;
    if (p < 0) from = Math.max(from, ratio);
    else to = Math.min(to, ratio);
    if (from > to) return false;
  }
  return from <= to;
}

function buildOctilinearCandidates(anchors, obstacles) {
  const points = [];
  const seen = new Set();
  const add = (point) => {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) return;
    if (obstacles.some((obstacle) => pointInsideRectangle(point, obstacle))) return;
    const key = pointKey(point);
    if (!seen.has(key)) {
      seen.add(key);
      points.push(point);
    }
  };

  anchors.forEach(add);
  for (let first = 0; first < anchors.length; first++) {
    for (let second = first + 1; second < anchors.length; second++) {
      for (let firstDirection = 0; firstDirection < 4; firstDirection++) {
        for (let secondDirection = 0; secondDirection < 4; secondDirection++) {
          if (firstDirection === secondDirection) continue;
          add(lineIntersection(
            anchors[first], firstDirection, anchors[second], secondDirection
          ));
        }
      }
    }
  }
  return points;
}

function pointInsideRectangle(point, obstacle) {
  return (
    point[0] > obstacle.left + GEOMETRY_EPSILON &&
    point[0] < obstacle.right - GEOMETRY_EPSILON &&
    point[1] > obstacle.top + GEOMETRY_EPSILON &&
    point[1] < obstacle.bottom - GEOMETRY_EPSILON
  );
}

// Directions: horizontal, vertical, descending diagonal, ascending diagonal.
function lineIntersection(first, firstDirection, second, secondDirection) {
  if (firstDirection > secondDirection) {
    return lineIntersection(second, secondDirection, first, firstDirection);
  }
  if (firstDirection === 0 && secondDirection === 1) return [second[0], first[1]];
  if (firstDirection === 0 && secondDirection === 2) {
    return [second[0] + second[1] - first[1], first[1]];
  }
  if (firstDirection === 0 && secondDirection === 3) {
    return [first[1] + second[0] - second[1], first[1]];
  }
  if (firstDirection === 1 && secondDirection === 2) {
    return [first[0], second[0] + second[1] - first[0]];
  }
  if (firstDirection === 1 && secondDirection === 3) {
    return [first[0], first[0] - second[0] + second[1]];
  }
  const descending = first[0] + first[1];
  const ascending = second[1] - second[0];
  return [(descending - ascending) / 2, (descending + ascending) / 2];
}

function buildVisibilityGraph(points, obstacles) {
  const graph = points.map(() => []);
  for (let direction = 0; direction < 4; direction++) {
    const lines = new Map();
    points.forEach((point, index) => {
      const key = lineKey(point, direction);
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key).push(index);
    });
    for (const indexes of lines.values()) {
      indexes.sort((a, b) => pointOrder(points[a], direction) - pointOrder(points[b], direction));
      for (let index = 1; index < indexes.length; index++) {
        const from = indexes[index - 1];
        const to = indexes[index];
        if (!segmentIsClear(points[from], points[to], obstacles)) continue;
        const distance = Math.hypot(
          points[to][0] - points[from][0], points[to][1] - points[from][1]
        );
        graph[from].push([to, distance]);
        graph[to].push([from, distance]);
      }
    }
  }
  return graph;
}

function lineKey(point, direction) {
  const value = direction === 0
    ? point[1]
    : direction === 1
      ? point[0]
      : direction === 2
        ? point[0] + point[1]
        : point[1] - point[0];
  return Math.round(value / GEOMETRY_EPSILON);
}

function pointOrder(point, direction) {
  return direction === 0 ? point[0] : point[1];
}

function pointKey(point) {
  return `${Math.round(point[0] / GEOMETRY_EPSILON)},${Math.round(point[1] / GEOMETRY_EPSILON)}`;
}

function findPointIndex(points, target) {
  const key = pointKey(target);
  return points.findIndex((point) => pointKey(point) === key);
}

function shortestPath(graph, start, end) {
  if (start < 0 || end < 0) return null;
  const distances = graph.map(() => Infinity);
  const previous = graph.map(() => -1);
  const visited = graph.map(() => false);
  distances[start] = 0;

  for (;;) {
    let current = -1;
    for (let index = 0; index < graph.length; index++) {
      if (!visited[index] && (current < 0 || distances[index] < distances[current])) {
        current = index;
      }
    }
    if (current < 0 || distances[current] === Infinity) return null;
    if (current === end) break;
    visited[current] = true;
    for (const [next, weight] of graph[current]) {
      const candidate = distances[current] + weight;
      if (candidate < distances[next]) {
        distances[next] = candidate;
        previous[next] = current;
      }
    }
  }

  const path = [];
  for (let current = end; current >= 0; current = previous[current]) {
    path.push(current);
    if (current === start) return path.reverse();
  }
  return null;
}

function removeCollinearPoints(points) {
  const cleaned = [];
  for (const point of points) {
    while (cleaned.length >= 2) {
      const first = cleaned[cleaned.length - 2];
      const second = cleaned[cleaned.length - 1];
      const cross = (second[0] - first[0]) * (point[1] - second[1]) -
        (second[1] - first[1]) * (point[0] - second[0]);
      if (Math.abs(cross) > GEOMETRY_EPSILON) break;
      cleaned.pop();
    }
    cleaned.push(point);
  }
  return cleaned;
}

function polylineLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index++) {
    length += Math.hypot(
      points[index][0] - points[index - 1][0],
      points[index][1] - points[index - 1][1]
    );
  }
  return length;
}

// ---- crossing detection ---------------------------------------------------

function onSeg(px, py, qx, qy, rx, ry) {
  return (
    Math.min(px, qx) - 1e-6 <= rx &&
    rx <= Math.max(px, qx) + 1e-6 &&
    Math.min(py, qy) - 1e-6 <= ry &&
    ry <= Math.max(py, qy) + 1e-6
  );
}

function orient(ax, ay, bx, by, cx, cy) {
  const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(v) < 1e-9) return 0;
  return v > 0 ? 1 : 2;
}

// True proper/segment intersection of segments p1p2 and p3p4.
export function segmentsIntersect(p1, p2, p3, p4) {
  const o1 = orient(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
  const o2 = orient(p1[0], p1[1], p2[0], p2[1], p4[0], p4[1]);
  const o3 = orient(p3[0], p3[1], p4[0], p4[1], p1[0], p1[1]);
  const o4 = orient(p3[0], p3[1], p4[0], p4[1], p2[0], p2[1]);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSeg(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1])) return true;
  if (o2 === 0 && onSeg(p1[0], p1[1], p2[0], p2[1], p4[0], p4[1])) return true;
  if (o3 === 0 && onSeg(p3[0], p3[1], p4[0], p4[1], p1[0], p1[1])) return true;
  if (o4 === 0 && onSeg(p3[0], p3[1], p4[0], p4[1], p2[0], p2[1])) return true;
  return false;
}

// Count crossings between two polylines, ignoring intersections that occur at
// a shared endpoint (routes that legitimately share a load or tap point).
export function countPolylineCrossings(a, b) {
  let n = 0;
  for (let i = 1; i < a.length; i++) {
    for (let j = 1; j < b.length; j++) {
      if (segmentsIntersect(a[i - 1], a[i], b[j - 1], b[j])) {
        // Skip if the only common point is a shared route endpoint.
        if (sharesEndpoint(a, b)) {
          if (!interiorCrossing(a[i - 1], a[i], b[j - 1], b[j])) continue;
        }
        n++;
      }
    }
  }
  return n;
}

function samePoint(p, q) {
  return Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.5;
}

function sharesEndpoint(a, b) {
  const ea = [a[0], a[a.length - 1]];
  const eb = [b[0], b[b.length - 1]];
  for (const p of ea) for (const q of eb) if (samePoint(p, q)) return true;
  return false;
}

// Does the intersection of two segments fall strictly inside both (not merely
// touching at a shared endpoint)?
function interiorCrossing(a1, a2, b1, b2) {
  const shared =
    samePoint(a1, b1) || samePoint(a1, b2) || samePoint(a2, b1) || samePoint(a2, b2);
  return !shared;
}
