// The static collision world on the ground plane: buildings, containers and shore walls as boxes,
// palm trunks and lamp posts as circles, bucketed in a spatial hash. It pushes moving circles out,
// answers line-of-sight questions for the police and casts rays for bullets and the camera.

const CELL = 24;

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.circles = [];
    this.cells = new Map();
    this.stamp = 0;
  }

  key(cx, cz) {
    return cx * 4096 + cz;
  }

  insert(item, minX, minZ, maxX, maxZ) {
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx += 1) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz += 1) {
        const k = this.key(cx, cz);
        if (!this.cells.has(k)) this.cells.set(k, []);
        this.cells.get(k).push(item);
      }
    }
  }

  /** A solid box from minX..maxX, minZ..maxZ, rising to `height` metres. */
  addBox(minX, minZ, maxX, maxZ, height = 50, tag = 'building') {
    const box = { kind: 'box', minX, minZ, maxX, maxZ, height, tag, mark: 0 };
    this.boxes.push(box);
    this.insert(box, minX, minZ, maxX, maxZ);
    return box;
  }

  addCircle(x, z, radius, height = 6, tag = 'pole') {
    const circle = { kind: 'circle', x, z, radius, height, tag, mark: 0 };
    this.circles.push(circle);
    this.insert(circle, x - radius, z - radius, x + radius, z + radius);
    return circle;
  }

  /** Every static item whose cells overlap a rectangle, each once. */
  query(minX, minZ, maxX, maxZ, out = []) {
    this.stamp += 1;
    out.length = 0;
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx += 1) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz += 1) {
        const list = this.cells.get(this.key(cx, cz));
        if (!list) continue;
        for (const item of list) {
          if (item.mark === this.stamp) continue;
          item.mark = this.stamp;
          out.push(item);
        }
      }
    }
    return out;
  }

  /**
   * Pushes a circle at `pos` out of everything it overlaps (pos is changed in place).
   * Returns the summed push normal and the deepest overlap, or null when nothing was touched.
   */
  resolveCircle(pos, radius, maxHeight = 99) {
    const items = this.query(pos.x - radius, pos.z - radius, pos.x + radius, pos.z + radius, this.scratch ?? (this.scratch = []));
    let nx = 0;
    let nz = 0;
    let depth = 0;
    let tag = null;
    for (const item of items) {
      if (item.height < 0.3 || (item.floor ?? 0) > maxHeight) continue;
      let dx;
      let dz;
      let dist;
      let reach;
      if (item.kind === 'box') {
        const px = Math.max(item.minX, Math.min(pos.x, item.maxX));
        const pz = Math.max(item.minZ, Math.min(pos.z, item.maxZ));
        dx = pos.x - px;
        dz = pos.z - pz;
        dist = Math.hypot(dx, dz);
        reach = radius;
        if (dist === 0) {
          // The centre is inside the box: leave by the nearest face.
          const exits = [pos.x - item.minX, item.maxX - pos.x, pos.z - item.minZ, item.maxZ - pos.z];
          const min = Math.min(...exits);
          const face = exits.indexOf(min);
          dx = face === 0 ? -1 : face === 1 ? 1 : 0;
          dz = face === 2 ? -1 : face === 3 ? 1 : 0;
          pos.x += dx * (min + radius);
          pos.z += dz * (min + radius);
          nx += dx;
          nz += dz;
          depth = Math.max(depth, min + radius);
          tag = item.tag;
          continue;
        }
      } else {
        dx = pos.x - item.x;
        dz = pos.z - item.z;
        dist = Math.hypot(dx, dz);
        reach = radius + item.radius;
        if (dist === 0) {
          dx = 1;
          dist = 1e-6;
        }
      }
      if (dist >= reach) continue;
      const push = reach - dist;
      const ux = dx / dist;
      const uz = dz / dist;
      pos.x += ux * push;
      pos.z += uz * push;
      nx += ux;
      nz += uz;
      depth = Math.max(depth, push);
      tag = item.tag;
    }
    if (depth === 0) return null;
    const length = Math.hypot(nx, nz) || 1;
    return { nx: nx / length, nz: nz / length, depth, tag };
  }

  /**
   * Distance along a ray from (ax, az) in unit direction (dx, dz) to the first item taller than
   * `minHeight`, up to maxDist; Infinity when nothing is hit.
   */
  raycast(ax, az, dx, dz, maxDist, minHeight = 1.2) {
    const bx = ax + dx * maxDist;
    const bz = az + dz * maxDist;
    const items = this.query(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), this.rayScratch ?? (this.rayScratch = []));
    let best = Infinity;
    for (const item of items) {
      if (item.height < minHeight) continue;
      const t = item.kind === 'box' ? rayBox(ax, az, dx, dz, item) : rayCircle(ax, az, dx, dz, item);
      if (t >= 0 && t < best && t <= maxDist) best = t;
    }
    return best;
  }

  /** True when a wall stands between two ground points (the police line of sight). */
  segmentBlocked(ax, az, bx, bz, minHeight = 2.5) {
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 1e-3) return false;
    return this.raycast(ax, az, (bx - ax) / length, (bz - az) / length, length, minHeight) < length;
  }
}

function rayBox(ax, az, dx, dz, box) {
  let tMin = -Infinity;
  let tMax = Infinity;
  if (Math.abs(dx) < 1e-9) {
    if (ax < box.minX || ax > box.maxX) return -1;
  } else {
    const t1 = (box.minX - ax) / dx;
    const t2 = (box.maxX - ax) / dx;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  }
  if (Math.abs(dz) < 1e-9) {
    if (az < box.minZ || az > box.maxZ) return -1;
  } else {
    const t1 = (box.minZ - az) / dz;
    const t2 = (box.maxZ - az) / dz;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  }
  if (tMax < Math.max(tMin, 0)) return -1;
  return Math.max(tMin, 0);
}

function rayCircle(ax, az, dx, dz, circle) {
  const ox = ax - circle.x;
  const oz = az - circle.z;
  const b = ox * dx + oz * dz;
  const c = ox * ox + oz * oz - circle.radius * circle.radius;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : c < 0 ? 0 : -1;
}
