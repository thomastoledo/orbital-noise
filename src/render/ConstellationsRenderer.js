import { clampInt } from "../utils/math.js";

/**
 * Orthogonal routed constellations (A* on a grid).
 * Paths are strictly horizontal/vertical and can occasionally snap to existing segments.
 */
export class Constellations {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number, int: (a: number, b: number) => number, bool: (p?: number) => boolean }} rng
   * @param {Array<{ x: number, y: number, size: number, bright: boolean }>} stars
   * @param {Array<{ cx: number, cy: number, r: number }>} planets
   * @param {{
   *  modules: number,
   *  connectChance: number,
   *  color?: string | null,
   *  pickColor?: ((rng: any) => string) | undefined,
   *  maxTurns?: number,
   *  loopChance?: number
   * }} options
   */
  draw(ctx, rng, stars, planets, options) {
    if (!stars.length) return;

    const {
      modules,
      connectChance,
      color = "#FFFFFF",
      pickColor,
      maxTurns = 3,
      loopChance = 0.55,
    } = options;

    const stroke = pickColor ? pickColor(rng) : color ?? "#FFFFFF";
    const router = buildRouter(planets, ctx.canvas.width, ctx.canvas.height, 10);
    const moduleCount = Math.max(3, modules);

    const brightIndices = stars.map((star, index) => (star.bright ? index : -1)).filter((index) => index >= 0);
    const pool = brightIndices.length >= 24 ? brightIndices : stars.map((_, index) => index);
    const used = new Set();

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    const routedSegments = [];

    for (let moduleIndex = 0; moduleIndex < moduleCount; moduleIndex++) {
      if (moduleIndex > 0 && rng.float() > Math.min(1, connectChance * 1.8)) continue;

      const pointsPerModule = rng.int(3, 5);
      const points = [];

      for (let i = 0; i < pointsPerModule; i++) {
        const index = pool[(rng.float() * pool.length) | 0];
        if (used.has(index) && rng.bool(0.7)) continue;
        used.add(index);
        points.push(stars[index]);
      }

      if (points.length < 2) continue;
      points.sort((a, b) => (a.x - b.x) || (a.y - b.y));

      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];

        const start = { x: a.x + a.size / 2, y: a.y + a.size / 2 };
        const directEnd = { x: b.x + b.size / 2, y: b.y + b.size / 2 };

        const shouldUseTrait = routedSegments.length > 0 && rng.bool(0.22);
        const traitTarget = shouldUseTrait
          ? snapToNearestSegmentCenter(start, routedSegments, 140)
          : null;

        const end = traitTarget ?? directEnd;

        let path = null;
        if (rng.bool(loopChance)) {
          path = trySquareLoop(router, start, end, rng);
        }

        if (!path) {
          const routed = route(router, start, end);
          if (!routed || routed.length < 2) continue;

          const simplified = simplifyOrtho(routed);
          path = limitOrthogonalTurns(router, simplified, maxTurns);
          if (!path || path.length < 2) continue;
        }

        path = enforceStrictOrthogonal(router, path);
        if (!path || path.length < 2) continue;

        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let index = 1; index < path.length; index++) {
          ctx.lineTo(path[index].x, path[index].y);
        }
        ctx.stroke();

        for (let index = 0; index < path.length - 1; index++) {
          routedSegments.push({ a: path[index], b: path[index + 1] });
        }
      }
    }

    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number, int: (a: number, b: number) => number, bool: (p?: number) => boolean }} rng
   * @param {Array<{ x: number, y: number, size: number, bright: boolean }>} stars
   * @param {Array<{ cx: number, cy: number, r: number }>} planets
   * @param {{
   *  modules: number,
   *  connectChance: number,
   *  color?: string | null,
   *  pickColor?: ((rng: any) => string) | undefined,
   *  maxTurns?: number,
   *  loopChance?: number
   * }} options
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  async drawAsync(ctx, rng, stars, planets, options, stepper) {
    if (!stars.length) return;

    const {
      modules,
      connectChance,
      color = "#FFFFFF",
      pickColor,
      maxTurns = 3,
      loopChance = 0.55,
    } = options;

    const stroke = pickColor ? pickColor(rng) : color ?? "#FFFFFF";
    const router = buildRouter(planets, ctx.canvas.width, ctx.canvas.height, 10);
    const moduleCount = Math.max(3, modules);

    const brightIndices = stars.map((star, index) => (star.bright ? index : -1)).filter((index) => index >= 0);
    const pool = brightIndices.length >= 24 ? brightIndices : stars.map((_, index) => index);
    const used = new Set();

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    const routedSegments = [];

    for (let moduleIndex = 0; moduleIndex < moduleCount; moduleIndex++) {
      if (moduleIndex > 0 && rng.float() > Math.min(1, connectChance * 1.8)) continue;

      const pointsPerModule = rng.int(3, 5);
      const points = [];

      for (let i = 0; i < pointsPerModule; i++) {
        const index = pool[(rng.float() * pool.length) | 0];
        if (used.has(index) && rng.bool(0.7)) continue;
        used.add(index);
        points.push(stars[index]);
      }

      if (points.length < 2) continue;
      points.sort((a, b) => (a.x - b.x) || (a.y - b.y));

      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];

        const start = { x: a.x + a.size / 2, y: a.y + a.size / 2 };
        const directEnd = { x: b.x + b.size / 2, y: b.y + b.size / 2 };

        const shouldUseTrait = routedSegments.length > 0 && rng.bool(0.22);
        const traitTarget = shouldUseTrait
          ? snapToNearestSegmentCenter(start, routedSegments, 140)
          : null;

        const end = traitTarget ?? directEnd;

        let path = null;
        if (rng.bool(loopChance)) {
          path = trySquareLoop(router, start, end, rng);
        }

        if (!path) {
          const routed = route(router, start, end);
          if (!routed || routed.length < 2) continue;

          const simplified = simplifyOrtho(routed);
          path = limitOrthogonalTurns(router, simplified, maxTurns);
          if (!path || path.length < 2) continue;
        }

        path = enforceStrictOrthogonal(router, path);
        if (!path || path.length < 2) continue;

        await strokeOrthoPathProgressive(ctx, path, stepper);

        for (let index = 0; index < path.length - 1; index++) {
          routedSegments.push({ a: path[index], b: path[index + 1] });
        }

        await stepper.yieldNow();
      }
    }

    ctx.restore();
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x: number, y: number}>} path
 * @param {import("../utils/stepper.js").Stepper} stepper
 */
async function strokeOrthoPathProgressive(ctx, path, stepper) {
  if (path.length < 2) return;

  const pixelStep = 6;
  const batchSteps = 36;

  let stepsInBatch = 0;
  let previous = path[0];

  ctx.beginPath();
  ctx.moveTo(previous.x, previous.y);

  for (let i = 1; i < path.length; i++) {
    const next = path[i];
    const deltaX = next.x - previous.x;
    const deltaY = next.y - previous.y;

    const length = Math.abs(deltaX) + Math.abs(deltaY);
    const steps = Math.max(1, Math.ceil(length / pixelStep));

    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const x = previous.x + deltaX * t;
      const y = previous.y + deltaY * t;
      ctx.lineTo(x, y);

      stepsInBatch++;
      if (stepsInBatch >= batchSteps) {
        ctx.stroke();
        stepsInBatch = 0;
        ctx.beginPath();
        ctx.moveTo(x, y);
        await stepper.yieldNow();
      }
    }

    previous = next;
  }

  ctx.stroke();
}

/**
 * @param {Array<{ cx: number, cy: number, r: number }>} planets
 * @param {number} width
 * @param {number} height
 * @param {number} grid
 */
function buildRouter(planets, width, height, grid) {
  const cols = Math.ceil(width / grid);
  const rows = Math.ceil(height / grid);
  const blocked = new Uint8Array(cols * rows);

  for (const planet of planets) {
    const radius = planet.r * 1.05;
    const x0 = Math.max(0, Math.floor((planet.cx - radius) / grid));
    const x1 = Math.min(cols - 1, Math.floor((planet.cx + radius) / grid));
    const y0 = Math.max(0, Math.floor((planet.cy - radius) / grid));
    const y1 = Math.min(rows - 1, Math.floor((planet.cy + radius) / grid));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const pointX = x * grid + grid / 2;
        const pointY = y * grid + grid / 2;
        const deltaX = pointX - planet.cx;
        const deltaY = pointY - planet.cy;
        if (deltaX * deltaX + deltaY * deltaY <= radius * radius) {
          blocked[y * cols + x] = 1;
        }
      }
    }
  }

  return { grid, cols, rows, blocked };
}

/**
 * @param {{grid: number, cols: number, rows: number, blocked: Uint8Array}} router
 * @param {{x: number, y: number}} startPx
 * @param {{x: number, y: number}} endPx
 */
function route(router, startPx, endPx) {
  const { grid, cols, rows, blocked } = router;

  const start = {
    x: clampInt(Math.floor(startPx.x / grid), 0, cols - 1),
    y: clampInt(Math.floor(startPx.y / grid), 0, rows - 1),
  };

  const goal = {
    x: clampInt(Math.floor(endPx.x / grid), 0, cols - 1),
    y: clampInt(Math.floor(endPx.y / grid), 0, rows - 1),
  };

  blocked[start.y * cols + start.x] = 0;
  blocked[goal.y * cols + goal.x] = 0;

  const cameFrom = aStar(cols, rows, blocked, start, goal);
  if (!cameFrom) return null;

  const cells = [];
  let current = key(goal.x, goal.y, cols);

  while (current !== null) {
    cells.push({ x: current % cols, y: (current / cols) | 0 });
    current = cameFrom[current];
  }

  cells.reverse();
  if (cells.length < 1) return null;

  const centers = cells.map((cell) => ({ x: cell.x * grid + grid / 2, y: cell.y * grid + grid / 2 }));
  const output = [];

  pushOrthoJoin(router, output, startPx, centers[0]);
  for (let i = 1; i < centers.length; i++) output.push(centers[i]);
  pushOrthoJoin(router, output, output[output.length - 1], endPx);

  return simplifyOrtho(output);
}

/**
 * @param {{grid: number, cols: number, rows: number, blocked: Uint8Array}} router
 * @param {Array<{x: number, y: number}>} points
 * @param {number} maxTurns
 */
function limitOrthogonalTurns(router, points, maxTurns) {
  if (!points || points.length < 2) return points;

  let turns = 0;
  let lastDirection = null;
  const output = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const previous = output[output.length - 1];
    const current = points[i];

    const deltaX = current.x - previous.x;
    const deltaY = current.y - previous.y;
    if (deltaX === 0 && deltaY === 0) continue;

    const direction = deltaX !== 0 ? "x" : "y";
    if (lastDirection && direction !== lastDirection) turns++;

    if (turns > maxTurns) {
      const end = points[points.length - 1];
      const joined = [];
      pushOrthoJoin(router, joined, previous, end);
      for (let index = 1; index < joined.length; index++) output.push(joined[index]);
      return simplifyOrtho(output);
    }

    output.push(current);
    lastDirection = direction;
  }

  return simplifyOrtho(output);
}

/**
 * @param {{grid: number, cols: number, rows: number, blocked: Uint8Array}} router
 * @param {{x: number, y: number}} start
 * @param {{x: number, y: number}} end
 * @param {{ int: (a: number, b: number) => number, bool: (p?: number) => boolean }} rng
 */
function trySquareLoop(router, start, end, rng) {
  const span = (rng.int(6, 18) * router.grid) | 0;
  const horizontalFirst = rng.bool(0.5);

  const p1 = horizontalFirst ? { x: start.x + span, y: start.y } : { x: start.x, y: start.y + span };
  const p2 = horizontalFirst
    ? { x: start.x + span, y: end.y + (rng.bool(0.5) ? span : -span) }
    : { x: end.x + (rng.bool(0.5) ? span : -span), y: start.y + span };
  const p3 = horizontalFirst ? { x: end.x, y: p2.y } : { x: p2.x, y: end.y };

  const path = [start, p1, p2, p3, end];

  for (let i = 0; i < path.length - 1; i++) {
    if (segmentHitsBlocked(router, path[i], path[i + 1])) return null;
  }

  return simplifyOrtho(path);
}

/**
 * @param {{grid: number, cols: number, rows: number, blocked: Uint8Array}} router
 * @param {Array<{x: number, y: number}>} points
 */
function enforceStrictOrthogonal(router, points) {
  if (!points || points.length < 2) return points;

  const output = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const previous = output[output.length - 1];
    const current = points[i];

    if (previous.x === current.x || previous.y === current.y) {
      output.push(current);
      continue;
    }

    const joined = [];
    pushOrthoJoin(router, joined, previous, current);
    for (let index = 1; index < joined.length; index++) output.push(joined[index]);
  }

  return simplifyOrtho(output);
}

/**
 * @param {{grid: number, cols: number, rows: number, blocked: Uint8Array}} router
 * @param {Array<{x: number, y: number}>} output
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 */
function pushOrthoJoin(router, output, a, b) {
  if (output.length === 0) output.push({ x: a.x, y: a.y });

  const start = output[output.length - 1];
  if (start.x === b.x || start.y === b.y) {
    output.push({ x: b.x, y: b.y });
    return;
  }

  const elbow1 = { x: start.x, y: b.y };
  const elbow2 = { x: b.x, y: start.y };

  const elbow1Clear = !segmentHitsBlocked(router, start, elbow1) && !segmentHitsBlocked(router, elbow1, b);
  const elbow2Clear = !segmentHitsBlocked(router, start, elbow2) && !segmentHitsBlocked(router, elbow2, b);

  if (elbow1Clear && elbow2Clear) {
    const dist1 =
      Math.abs(start.x - elbow1.x) +
      Math.abs(start.y - elbow1.y) +
      Math.abs(elbow1.x - b.x) +
      Math.abs(elbow1.y - b.y);

    const dist2 =
      Math.abs(start.x - elbow2.x) +
      Math.abs(start.y - elbow2.y) +
      Math.abs(elbow2.x - b.x) +
      Math.abs(elbow2.y - b.y);

    output.push(dist1 <= dist2 ? elbow1 : elbow2);
    output.push({ x: b.x, y: b.y });
    return;
  }

  if (elbow1Clear) {
    output.push(elbow1);
    output.push({ x: b.x, y: b.y });
    return;
  }

  if (elbow2Clear) {
    output.push(elbow2);
    output.push({ x: b.x, y: b.y });
    return;
  }

  output.push(elbow1);
  output.push({ x: b.x, y: b.y });
}

/**
 * @param {{grid: number, cols: number, rows: number, blocked: Uint8Array}} router
 * @param {{x: number, y: number}} a
 * @param {{x: number, y: number}} b
 */
function segmentHitsBlocked(router, a, b) {
  const { grid, cols, rows, blocked } = router;
  const steps = Math.max(1, Math.ceil((Math.abs(b.x - a.x) + Math.abs(b.y - a.y)) / grid));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;

    const cellX = clampInt(Math.floor(x / grid), 0, cols - 1);
    const cellY = clampInt(Math.floor(y / grid), 0, rows - 1);

    if (blocked[cellY * cols + cellX]) return true;
  }

  return false;
}

/**
 * @param {number} cols
 * @param {number} rows
 * @param {Uint8Array} blocked
 * @param {{x: number, y: number}} start
 * @param {{x: number, y: number}} goal
 */
function aStar(cols, rows, blocked, start, goal) {
  const total = cols * rows;

  const gScore = new Float32Array(total);
  for (let i = 0; i < total; i++) gScore[i] = Infinity;

  const cameFrom = new Int32Array(total);
  for (let i = 0; i < total; i++) cameFrom[i] = -1;

  const openSet = new MinHeap();
  const startKey = key(start.x, start.y, cols);
  const goalKey = key(goal.x, goal.y, cols);

  gScore[startKey] = 0;
  openSet.push({ k: startKey, f: heuristic(start.x, start.y, goal.x, goal.y) });

  const inOpenSet = new Uint8Array(total);
  inOpenSet[startKey] = 1;

  while (!openSet.isEmpty()) {
    const current = openSet.pop();
    const currentKey = current.k;
    inOpenSet[currentKey] = 0;

    if (currentKey === goalKey) {
      const output = new Array(total).fill(null);
      for (let i = 0; i < total; i++) {
        if (cameFrom[i] !== -1) output[i] = cameFrom[i];
      }
      output[startKey] = null;
      return output;
    }

    const x = currentKey % cols;
    const y = (currentKey / cols) | 0;

    const neighbors = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];

    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.x >= cols || neighbor.y < 0 || neighbor.y >= rows) continue;

      const neighborKey = key(neighbor.x, neighbor.y, cols);
      if (blocked[neighborKey]) continue;

      const tentative = gScore[currentKey] + 1;
      if (tentative < gScore[neighborKey]) {
        cameFrom[neighborKey] = currentKey;
        gScore[neighborKey] = tentative;

        const fScore = tentative + heuristic(neighbor.x, neighbor.y, goal.x, goal.y);
        if (!inOpenSet[neighborKey]) {
          inOpenSet[neighborKey] = 1;
          openSet.push({ k: neighborKey, f: fScore });
        } else {
          openSet.decreaseKey(neighborKey, fScore);
        }
      }
    }
  }

  return null;
}

/**
 * @param {Array<{x: number, y: number}>} points
 * @returns {Array<{x: number, y: number}>}
 */
function simplifyOrtho(points) {
  if (!points || points.length === 0) return [];
  if (points.length <= 2) return dedupe(points);

  const deduped = dedupe(points);
  if (deduped.length <= 2) return deduped;

  const output = [deduped[0]];
  for (let i = 1; i < deduped.length - 1; i++) {
    const a = output[output.length - 1];
    const b = deduped[i];
    const c = deduped[i + 1];

    const deltaABx = b.x - a.x;
    const deltaABy = b.y - a.y;
    const deltaBCx = c.x - b.x;
    const deltaBCy = c.y - b.y;

    if ((deltaABx === 0 && deltaBCx === 0) || (deltaABy === 0 && deltaBCy === 0)) continue;

    output.push(b);
  }

  output.push(deduped[deduped.length - 1]);
  return output;
}

/**
 * @param {Array<{x: number, y: number}>} points
 */
function dedupe(points) {
  const output = [];
  for (const point of points) {
    const previous = output[output.length - 1];
    if (!previous || previous.x !== point.x || previous.y !== point.y) {
      output.push({ x: point.x, y: point.y });
    }
  }
  return output;
}

/**
 * @param {{x: number, y: number}} point
 * @param {Array<{ a: {x: number, y: number}, b: {x: number, y: number} }>} segments
 * @param {number} maxDistance
 */
function snapToNearestSegmentCenter(point, segments, maxDistance) {
  let best = null;
  let bestDistanceSquared = maxDistance * maxDistance;

  for (const segment of segments) {
    const centerX = (segment.a.x + segment.b.x) / 2;
    const centerY = (segment.a.y + segment.b.y) / 2;

    const deltaX = centerX - point.x;
    const deltaY = centerY - point.y;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;

    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared;
      best = { x: centerX, y: centerY };
    }
  }

  return best;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} cols
 */
function key(x, y, cols) {
  return y * cols + x;
}

/**
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 */
function heuristic(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

class MinHeap {
  constructor() {
    /** @type {Array<{k: number, f: number}>} */
    this.heap = [];
    this.positions = new Map();
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  /** @param {{k: number, f: number}} node */
  push(node) {
    this.heap.push(node);
    this.positions.set(node.k, this.heap.length - 1);
    this.#bubbleUp(this.heap.length - 1);
  }

  pop() {
    const root = this.heap[0];
    const tail = this.heap.pop();
    this.positions.delete(root.k);

    if (this.heap.length > 0 && tail) {
      this.heap[0] = tail;
      this.positions.set(tail.k, 0);
      this.#bubbleDown(0);
    }

    return root;
  }

  /**
   * @param {number} keyValue
   * @param {number} nextF
   */
  decreaseKey(keyValue, nextF) {
    const index = this.positions.get(keyValue);
    if (index === undefined) return;
    if (nextF >= this.heap[index].f) return;

    this.heap[index].f = nextF;
    this.#bubbleUp(index);
  }

  /** @param {number} index */
  #bubbleUp(index) {
    while (index > 0) {
      const parent = ((index - 1) / 2) | 0;
      if (this.heap[parent].f <= this.heap[index].f) break;
      this.#swap(index, parent);
      index = parent;
    }
  }

  /** @param {number} index */
  #bubbleDown(index) {
    const size = this.heap.length;
    while (true) {
      let target = index;
      const left = index * 2 + 1;
      const right = left + 1;

      if (left < size && this.heap[left].f < this.heap[target].f) target = left;
      if (right < size && this.heap[right].f < this.heap[target].f) target = right;

      if (target === index) break;
      this.#swap(index, target);
      index = target;
    }
  }

  /**
   * @param {number} i
   * @param {number} j
   */
  #swap(i, j) {
    const a = this.heap[i];
    const b = this.heap[j];
    this.heap[i] = b;
    this.heap[j] = a;
    this.positions.set(this.heap[i].k, i);
    this.positions.set(this.heap[j].k, j);
  }
}
