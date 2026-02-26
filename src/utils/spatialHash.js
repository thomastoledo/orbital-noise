export function gridKey(cx, cy) {
  return `${cx},${cy}`;
}

export function gridInsert(grid, CELL, idx, s) {
  const cx0 = Math.floor(s.x / CELL);
  const cy0 = Math.floor(s.y / CELL);
  const key = gridKey(cx0, cy0);
  let arr = grid.get(key);
  if (!arr) {
    arr = [];
    grid.set(key, arr);
  }
  arr.push(idx);
}

export function aabbIntersects(x1, y1, w1, h1, x2, y2, w2, h2) {
  return !(x1 + w1 <= x2 || x2 + w2 <= x1 || y1 + h1 <= y2 || y2 + h2 <= y1);
}

export function starOverlaps(x, y, size, grid, stars, CELL) {
  const cx0 = Math.floor(x / CELL);
  const cy0 = Math.floor(y / CELL);

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const key = gridKey(cx0 + dx, cy0 + dy);
      const arr = grid.get(key);
      if (!arr) continue;

      for (const idx of arr) {
        const s = stars[idx];
        if (aabbIntersects(x, y, size, size, s.x, s.y, s.size, s.size)) return true;
      }
    }
  }
  return false;
}
