import * as THREE from 'three';

export class ObjectPicker {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  onSelect: ((bodyId: number | null) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, camera: THREE.Camera, meshes: () => THREE.Mesh[]) {
    canvas.addEventListener('click', (e) => {
      // Ignore if orbiting (moved significantly)
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, camera);
      const hits = this.raycaster.intersectObjects(meshes(), false);

      if (hits.length > 0) {
        const bodyId = hits[0]!.object.userData['bodyId'] as number | undefined;
        this.onSelect?.(bodyId ?? null);
      } else {
        this.onSelect?.(null);
      }
    });
  }
}
