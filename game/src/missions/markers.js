// Mission markers in the world: a glowing column of light where to go, a spinning chevron above a
// person or car to chase, and the bobbing crate on the pier. One of each, moved as objectives change.
import * as THREE from 'three';

export class MissionMarkers {
  constructor(scene) {
    const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xffc23d, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 7, 24, 1, true), beamMaterial);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffd166 }));
    this.ring.rotation.x = Math.PI / 2;
    this.place = new THREE.Group();
    this.place.add(this.beam, this.ring);
    this.beam.position.y = 3.5;
    this.ring.position.y = 0.25;
    this.place.visible = false;

    const chevron = new THREE.ConeGeometry(0.6, 1.1, 4);
    chevron.rotateX(Math.PI);
    this.chevron = new THREE.Mesh(chevron, new THREE.MeshBasicMaterial({ color: 0xff4d5a }));
    this.chevron.visible = false;

    this.crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0xa87442, roughness: 0.8 }));
    this.crate.castShadow = true;
    this.crate.visible = false;

    this.contact = new THREE.Group();
    const contactBeam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 5, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x5ee7ff, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
    contactBeam.position.y = 2.5;
    this.contact.add(contactBeam);
    this.contact.visible = false;
    scene.add(this.place, this.chevron, this.crate, this.contact);
  }

  showPlace(point, radius = 2) {
    this.place.visible = Boolean(point);
    if (!point) return;
    this.place.position.set(point.x, point.y ?? 0.15, point.z);
    this.place.scale.set(radius, 1, radius);
  }

  showTarget(position) {
    this.chevron.visible = Boolean(position);
    if (position) this.chevron.position.set(position.x, (position.y ?? 0) + 3.6, position.z);
  }

  showCrate(point) {
    this.crate.visible = Boolean(point);
    if (point) this.crate.position.set(point.x, 0.45, point.z);
  }

  showContact(point) {
    this.contact.visible = Boolean(point);
    if (point) this.contact.position.set(point.x, 0.15, point.z);
  }

  update(time) {
    this.ring.scale.setScalar(1 + Math.sin(time * 4) * 0.08);
    this.beam.material.opacity = 0.3 + Math.sin(time * 3) * 0.08;
    this.chevron.rotation.y = time * 3;
    this.chevron.position.y += Math.sin(time * 5) * 0.01;
    this.crate.rotation.y = time * 0.8;
  }
}
