import * as THREE from 'three';
import { RigidBody, ShapeType, Vec3, Quat } from 'flight-engine-js';

const PALETTE = [
  0x4a9eff, 0xff6b4a, 0x4aff8a, 0xffe14a,
  0xd04aff, 0xff4a8a, 0x4affff, 0xff9e4a,
];

export class BodyRenderer {
  private meshes: Map<number, THREE.Mesh> = new Map();
  private scene: THREE.Scene;
  private colorIndex = 0;
  selectedId: number | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  addBody(body: RigidBody): void {
    const color = PALETTE[this.colorIndex % PALETTE.length] ?? 0xffffff;
    this.colorIndex++;

    let geo: THREE.BufferGeometry;
    const shape = body.shape;
    if (shape.type === ShapeType.Sphere) {
      geo = new THREE.SphereGeometry(shape.radius, 16, 12);
    } else if (shape.type === ShapeType.Cylinder) {
      geo = new THREE.CylinderGeometry(shape.radius, shape.radius, shape.height, 16);
    } else {
      const { x, y, z } = shape.halfExtents;
      geo = new THREE.BoxGeometry(x * 2, y * 2, z * 2);
    }

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.1,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData['bodyId'] = body.id;
    this.scene.add(mesh);
    this.meshes.set(body.id, mesh);
  }

  removeBody(body: RigidBody): void {
    const mesh = this.meshes.get(body.id);
    if (mesh) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.meshes.delete(body.id);
    }
  }

  syncBodies(bodies: RigidBody[], alpha: number): void {
    for (const body of bodies) {
      const mesh = this.meshes.get(body.id);
      if (!mesh) continue;

      // Interpolate position
      const prevPos = body.previousPosition;
      const currPos = body.position;
      mesh.position.set(
        prevPos.x + (currPos.x - prevPos.x) * alpha,
        prevPos.y + (currPos.y - prevPos.y) * alpha,
        prevPos.z + (currPos.z - prevPos.z) * alpha
      );

      // Slerp orientation
      const prevOri = body.previousOrientation;
      const currOri = body.orientation;
      const interp = Quat.slerp(prevOri, currOri, alpha);
      mesh.quaternion.set(interp.x, interp.y, interp.z, interp.w);

      // Highlight selected
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (body.id === this.selectedId) {
        mat.emissive.setHex(0x2255aa);
        mat.emissiveIntensity = 0.4;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }
  }

  getMesh(bodyId: number): THREE.Mesh | undefined {
    return this.meshes.get(bodyId);
  }

  getAllMeshes(): THREE.Mesh[] {
    return Array.from(this.meshes.values());
  }

  clear(): void {
    for (const [, mesh] of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.meshes.clear();
    this.colorIndex = 0;
  }
}
