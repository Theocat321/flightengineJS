import { RigidBody } from '../physics/RigidBody.js';
import { ShapeType } from '../physics/shapes.js';
import { Vec3 } from '../math/Vec3.js';
import { Quat } from '../math/Quat.js';

export type PresetName = 'Glider' | 'Rocket' | 'Ball' | 'Box';

export interface SpawnConfig {
  position?: Vec3;
  orientation?: Quat;
  velocity?: Vec3;
}

export function spawnPreset(name: PresetName, config: SpawnConfig = {}): RigidBody {
  let body: RigidBody;

  switch (name) {
    case 'Glider':
      body = new RigidBody(
        { type: ShapeType.Box, halfExtents: { x: 1, y: 0.1, z: 0.5 } },
        5,
        { wingArea: 4, cd: 0.04, cl0: 0.1, clSlope: 5, thrustMagnitude: 0 }
      );
      body.position.set(0, 30, 0);
      body.velocity.set(0, 0, -15); // initial forward speed
      body.restitution = 0.2;
      body.friction = 0.6;
      break;

    case 'Rocket':
      body = new RigidBody(
        { type: ShapeType.Box, halfExtents: { x: 0.15, y: 0.15, z: 0.75 } },
        10,
        { wingArea: 0.1, cd: 0.3, cl0: 0, clSlope: 0, thrustMagnitude: 200 }
      );
      body.position.set(0, 1, 0);
      body.restitution = 0.1;
      body.friction = 0.4;
      // Orient rocket to point upward: rotate -90° around X so forward (0,0,-1) -> up (0,1,0)
      body.orientation = Quat.fromAxisAngle(new Vec3(1, 0, 0), Math.PI / 2);
      break;

    case 'Ball':
      body = new RigidBody(
        { type: ShapeType.Sphere, radius: 0.5 },
        2,
        { wingArea: 0.8, cd: 0.47, cl0: 0, clSlope: 0, thrustMagnitude: 0 }
      );
      body.position.set(0, 10, 0);
      body.restitution = 0.7;
      body.friction = 0.3;
      break;

    case 'Box':
      body = new RigidBody(
        { type: ShapeType.Box, halfExtents: { x: 0.25, y: 0.25, z: 0.25 } },
        3,
        { wingArea: 0.25, cd: 1.05, cl0: 0, clSlope: 0, thrustMagnitude: 0 }
      );
      body.position.set(0, 8, 0);
      body.restitution = 0.3;
      body.friction = 0.6;
      break;
  }

  if (config.position) body.position.copyFrom(config.position);
  if (config.orientation) body.orientation = config.orientation.clone();
  if (config.velocity) body.velocity.copyFrom(config.velocity);

  body.previousPosition.copyFrom(body.position);
  body.previousOrientation = body.orientation.clone();

  return body;
}

export const PRESET_NAMES: PresetName[] = ['Glider', 'Rocket', 'Ball', 'Box'];
