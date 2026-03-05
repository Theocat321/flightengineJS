import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Vec3 } from 'flight-engine-js';

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;

  private followTarget: THREE.Object3D | null = null;
  private followOffset = new THREE.Vector3(0, 5, 15);
  private cameraLerpPos = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();

    // Sky gradient
    this.scene.background = new THREE.Color(0x1a2a4a);
    this.scene.fog = new THREE.Fog(0x1a2a4a, 200, 600);

    this.camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    this.camera.position.set(0, 15, 40);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.49;

    this._setupLighting();
    this._setupGround();

    window.addEventListener('resize', () => this._onResize(canvas));
    this.cameraLerpPos.copy(this.camera.position);
  }

  private _setupLighting(): void {
    const hemi = new THREE.HemisphereLight(0x8ab4d4, 0x3a5a3a, 0.6);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff0e0, 1.2);
    sun.position.set(100, 100, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -150;
    sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150;
    sun.shadow.camera.bottom = -150;
    this.scene.add(sun);

    const ambient = new THREE.AmbientLight(0x204060, 0.3);
    this.scene.add(ambient);
  }

  private _setupGround(): void {
    const grid = new THREE.GridHelper(500, 50, 0x334455, 0x223344);
    this.scene.add(grid);

    const groundGeo = new THREE.PlaneGeometry(500, 500);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a2e1a, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private _onResize(canvas: HTMLCanvasElement): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  setFollowTarget(obj: THREE.Object3D | null): void {
    this.followTarget = obj;
    if (!obj) {
      this.controls.enabled = true;
    }
  }

  snapToPosition(x: number, y: number, z: number): void {
    const target = new THREE.Vector3(x, y, z);
    const camPos = target.clone().add(this.followOffset);
    this.camera.position.copy(camPos);
    this.cameraLerpPos.copy(camPos);
    this.controls.target.copy(target);
    this.controls.update();
  }

  update(alpha: number): void {
    if (this.followTarget) {
      // Use world-space offset so camera doesn't spin with the object
      const targetPos = this.followTarget.position.clone().add(this.followOffset);
      this.cameraLerpPos.lerp(targetPos, 0.05);
      this.camera.position.copy(this.cameraLerpPos);
      this.camera.lookAt(this.followTarget.position);
    } else {
      this.controls.update();
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
