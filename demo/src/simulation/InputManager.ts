export class InputManager {
  private keys: Set<string> = new Set();

  constructor() {
    window.addEventListener('keydown', e => {
      this.keys.add(e.code);
      e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      this.keys.delete(e.code);
    });
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  // Pitch: nose up (W) / nose down (S)
  getPitchInput(): number {
    return (this.isDown('KeyW') ? -1 : 0) + (this.isDown('KeyS') ? 1 : 0);
  }

  // Roll: left wing down (A) / right wing down (D)
  getRollInput(): number {
    return (this.isDown('KeyA') ? -1 : 0) + (this.isDown('KeyD') ? 1 : 0);
  }

  // Yaw: nose left (Q) / nose right (E)
  getYawInput(): number {
    return (this.isDown('KeyQ') ? -1 : 0) + (this.isDown('KeyE') ? 1 : 0);
  }

  isThrustActive(): boolean {
    return this.isDown('Space');
  }

  isResetPressed(): boolean {
    return this.isDown('KeyR');
  }
}
