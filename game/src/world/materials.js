// The shared materials of the city, made once: one per surface kind so each kind draws in one call.
import * as THREE from 'three';
import * as tex from './textures.js';

let materials = null;

export function cityMaterials() {
  if (materials) return materials;
  const standard = (options) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...options });
  materials = {
    asphalt: standard({ map: tex.asphaltTexture(), roughness: 0.95 }),
    paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    sidewalk: standard({ map: tex.sidewalkTexture(), roughness: 0.9 }),
    sand: standard({ map: tex.sandTexture(), roughness: 1 }),
    grass: standard({ map: tex.grassTexture(), roughness: 1 }),
    plaza: standard({ map: tex.plazaTexture(), roughness: 0.8 }),
    concrete: standard({ map: tex.concreteTexture(), roughness: 0.95 }),
    tower: standard({ map: tex.towerFacadeTexture(), vertexColors: true, roughness: 0.22, metalness: 0.15 }),
    stucco: standard({ map: tex.stuccoFacadeTexture(), vertexColors: true, roughness: 0.85 }),
    house: standard({ map: tex.houseFacadeTexture(), vertexColors: true, roughness: 0.85 }),
    warehouse: standard({ map: tex.warehouseFacadeTexture(), vertexColors: true, roughness: 0.7, metalness: 0.1 }),
    shopfront: standard({ map: tex.shopfrontTexture(), vertexColors: true, roughness: 0.5 }),
    roof: standard({ map: tex.roofTexture(), vertexColors: true, roughness: 1 }),
    tinted: standard({ vertexColors: true, roughness: 0.75 }),
    metal: standard({ vertexColors: true, roughness: 0.45, metalness: 0.4 }),
    water: new THREE.MeshPhongMaterial({ color: 0x1f8fb0, specular: 0xfff2d0, shininess: 90, transparent: true, opacity: 0.93 }),
    pool: new THREE.MeshPhongMaterial({ color: 0x4fd4e6, specular: 0xffffff, shininess: 120 }),
    trunk: standard({ color: 0x8a6a4a, roughness: 1 }),
    frond: standard({ color: 0x4d8f3a, roughness: 0.8, side: THREE.DoubleSide }),
    lampPost: standard({ color: 0x3b4148, roughness: 0.5, metalness: 0.5 }),
    lampGlow: new THREE.MeshBasicMaterial({ color: 0xfff1c9 }),
  };
  return materials;
}
