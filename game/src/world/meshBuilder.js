// Accumulates many boxes and quads into one BufferGeometry, so a whole district's buildings, roads or
// curbs draw in a single call. UVs are in world metres divided by the texture's tile size, so windows,
// lane paint and paving keep a constant size on every building and road.
import * as THREE from 'three';

export class MeshBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.colors = [];
  }

  get vertexCount() {
    return this.positions.length / 3;
  }

  /** One quad from four corners (counter-clockwise seen from the front) with UVs and a tint. */
  quad(a, b, c, d, normal, uvA, uvB, uvC, uvD, color) {
    const corners = [a, b, c, a, c, d];
    const uvs = [uvA, uvB, uvC, uvA, uvC, uvD];
    for (let i = 0; i < 6; i += 1) {
      this.positions.push(corners[i][0], corners[i][1], corners[i][2]);
      this.normals.push(normal[0], normal[1], normal[2]);
      this.uvs.push(uvs[i][0], uvs[i][1]);
      this.colors.push(color.r, color.g, color.b);
    }
  }

  /** A flat rectangle on the ground at height y, UVs in metres / tile. */
  ground(minX, minZ, maxX, maxZ, y, tile, color = WHITE) {
    this.quad(
      [minX, y, maxZ], [maxX, y, maxZ], [maxX, y, minZ], [minX, y, minZ], [0, 1, 0],
      [minX / tile, maxZ / tile], [maxX / tile, maxZ / tile], [maxX / tile, minZ / tile], [minX / tile, minZ / tile],
      color,
    );
  }

  /**
   * An axis-aligned box from its base centre. tileU/tileV size the side UVs in metres; vOffset shifts
   * them vertically (so an upper storey continues the pattern). top/bottom choose which caps to emit.
   */
  box(cx, baseY, cz, width, height, depth, { tileU = 4, tileV = 4, vOffset = 0, color = WHITE, top = true, bottom = false, sides = true } = {}) {
    const x0 = cx - width / 2;
    const x1 = cx + width / 2;
    const z0 = cz - depth / 2;
    const z1 = cz + depth / 2;
    const y0 = baseY;
    const y1 = baseY + height;
    const v0 = (y0 + vOffset) / tileV;
    const v1 = (y1 + vOffset) / tileV;
    if (sides) {
      const uw = width / tileU;
      const ud = depth / tileU;
      // South (+z)
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [0, v0], [uw, v0], [uw, v1], [0, v1], color);
      // North (-z)
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [0, v0], [uw, v0], [uw, v1], [0, v1], color);
      // East (+x)
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [0, v0], [ud, v0], [ud, v1], [0, v1], color);
      // West (-x)
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [0, v0], [ud, v0], [ud, v1], [0, v1], color);
    }
    if (top) {
      this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0],
        [x0 / tileU, z1 / tileU], [x1 / tileU, z1 / tileU], [x1 / tileU, z0 / tileU], [x0 / tileU, z0 / tileU], color);
    }
    if (bottom) {
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [0, 0], [1, 0], [1, 1], [0, 1], color);
    }
  }

  build() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return geometry;
  }
}

const WHITE = new THREE.Color(1, 1, 1);
