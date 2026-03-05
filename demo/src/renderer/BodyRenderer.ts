import * as THREE from 'three';
import { RigidBody, ShapeType, Quat } from 'flight-engine-js';

const PALETTE = [
  0x4a9eff, 0xff6b4a, 0x4aff8a, 0xffe14a,
  0xd04aff, 0xff4a8a, 0x4affff, 0xff9e4a,
];

function createMissileObject(radius: number, height: number, color: number): THREE.Object3D {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 });
  const noseMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.5 });
  const finMat  = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5, metalness: 0.4 });
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.8 });

  // ── Body cylinder aligned along -Z (physics forward direction)
  // THREE.CylinderGeometry axis is Y. Rotate X by PI/2 → axis becomes Z.
  const bodyGeo = new THREE.CylinderGeometry(radius, radius, height, 20);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  group.add(body);

  // ── Nose cone at -Z end (forward)
  // ConeGeometry tip is at +Y, base at -Y. Rotate X by -PI/2 → tip toward -Z.
  const noseLen = radius * 5;
  const noseGeo = new THREE.ConeGeometry(radius, noseLen, 20);
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -(height / 2 + noseLen / 2);
  nose.castShadow = true;
  group.add(nose);

  // ── Nozzle at +Z end (tail)
  const nozzleGeo = new THREE.CylinderGeometry(radius * 0.6, radius * 0.8, radius * 1.2, 12);
  const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = height / 2 + radius * 0.6;
  group.add(nozzle);

  // ── 4 fins at tail (+Z end), 90° apart
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const finW = radius * 0.08;
    const finH = radius * 3.5;
    const finD = height * 0.28;
    const finGeo = new THREE.BoxGeometry(finW, finH, finD);
    const fin = new THREE.Mesh(finGeo, finMat);
    // Rotate the fin around Z axis to spread them 90° apart, then tilt to lie along body
    fin.rotation.z = angle;
    // Offset outward from body axis, at the tail
    const outDist = radius + finH / 2;
    fin.position.x = Math.cos(angle + Math.PI / 2) * outDist;
    fin.position.y = Math.sin(angle + Math.PI / 2) * outDist;
    fin.position.z = height * 0.35;
    fin.castShadow = true;
    group.add(fin);
  }

  return group;
}

export class BodyRenderer {
  private objects: Map<number, THREE.Object3D> = new Map();
  private scene: THREE.Scene;
  private colorIndex = 0;
  selectedId: number | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  addBody(body: RigidBody): void {
    const color = PALETTE[this.colorIndex % PALETTE.length] ?? 0xffffff;
    this.colorIndex++;

    const shape = body.shape;
    let obj: THREE.Object3D;

    if (shape.type === ShapeType.Cylinder) {
      obj = createMissileObject(shape.radius, shape.height, color);
    } else {
      let geo: THREE.BufferGeometry;
      if (shape.type === ShapeType.Sphere) {
        geo = new THREE.SphereGeometry(shape.radius, 16, 12);
      } else {
        const { x, y, z } = shape.halfExtents;
        geo = new THREE.BoxGeometry(x * 2, y * 2, z * 2);
      }
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      obj = mesh;
    }

    // Tag root and all descendants with bodyId so raycasting works on groups
    obj.userData['bodyId'] = body.id;
    obj.traverse(child => { child.userData['bodyId'] = body.id; });

    this.scene.add(obj);
    this.objects.set(body.id, obj);
  }

  removeBody(body: RigidBody): void {
    const obj = this.objects.get(body.id);
    if (obj) {
      this.scene.remove(obj);
      obj.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.objects.delete(body.id);
    }
  }

  syncBodies(bodies: RigidBody[], alpha: number): void {
    for (const body of bodies) {
      const obj = this.objects.get(body.id);
      if (!obj) continue;

      const prevPos = body.previousPosition;
      const currPos = body.position;
      obj.position.set(
        prevPos.x + (currPos.x - prevPos.x) * alpha,
        prevPos.y + (currPos.y - prevPos.y) * alpha,
        prevPos.z + (currPos.z - prevPos.z) * alpha
      );

      const interp = Quat.slerp(body.previousOrientation, body.orientation, alpha);
      obj.quaternion.set(interp.x, interp.y, interp.z, interp.w);

      const isSelected = body.id === this.selectedId;
      obj.traverse(child => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          mat.emissive.setHex(isSelected ? 0x2255aa : 0x000000);
          mat.emissiveIntensity = isSelected ? 0.4 : 0;
        }
      });
    }
  }

  getObject(bodyId: number): THREE.Object3D | undefined {
    return this.objects.get(bodyId);
  }

  // Keep getMesh signature for callsites that just need an Object3D for camera targeting
  getMesh(bodyId: number): THREE.Object3D | undefined {
    return this.objects.get(bodyId);
  }

  getAllMeshes(): THREE.Object3D[] {
    return Array.from(this.objects.values());
  }

  clear(): void {
    for (const [, obj] of this.objects) {
      this.scene.remove(obj);
      obj.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
    this.objects.clear();
    this.colorIndex = 0;
  }
}
