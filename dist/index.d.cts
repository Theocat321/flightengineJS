declare class Vec3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    add(v: Vec3): Vec3;
    sub(v: Vec3): Vec3;
    scale(s: number): Vec3;
    negate(): Vec3;
    clone(): Vec3;
    dot(v: Vec3): number;
    cross(v: Vec3): Vec3;
    lengthSq(): number;
    length(): number;
    normalize(): Vec3;
    addMut(v: Vec3): this;
    subMut(v: Vec3): this;
    scaleMut(s: number): this;
    set(x: number, y: number, z: number): this;
    copyFrom(v: Vec3): this;
    static zero(): Vec3;
    static one(): Vec3;
    static up(): Vec3;
    static forward(): Vec3;
    static right(): Vec3;
    static lerp(a: Vec3, b: Vec3, t: number): Vec3;
}

declare class Mat3 {
    readonly data: Float64Array;
    constructor(data?: Float64Array);
    static identity(): Mat3;
    static diagonal(x: number, y: number, z: number): Mat3;
    static fromQuat(q: Quat): Mat3;
    multiply(b: Mat3): Mat3;
    multiplyVec3(v: Vec3): Vec3;
    transpose(): Mat3;
    sandwichTransform(R: Mat3): Mat3;
    clone(): Mat3;
}

declare class Quat {
    x: number;
    y: number;
    z: number;
    w: number;
    constructor(x?: number, y?: number, z?: number, w?: number);
    multiply(q: Quat): Quat;
    rotateVector(v: Vec3): Vec3;
    conjugate(): Quat;
    normalize(): Quat;
    static fromAxisAngle(axis: Vec3, angle: number): Quat;
    toMat3(): Mat3;
    integrate(omega: Vec3, dt: number): Quat;
    static slerp(a: Quat, b: Quat, t: number): Quat;
    clone(): Quat;
    static identity(): Quat;
}

declare enum ShapeType {
    Sphere = "Sphere",
    Box = "Box"
}
interface SphereShape {
    type: ShapeType.Sphere;
    radius: number;
}
interface BoxShape {
    type: ShapeType.Box;
    halfExtents: {
        x: number;
        y: number;
        z: number;
    };
}
type Shape = SphereShape | BoxShape;
declare function computeInertiaTensor(shape: Shape, mass: number): Mat3;

interface AeroProperties {
    wingArea: number;
    cd: number;
    cl0: number;
    clSlope: number;
    thrustMagnitude: number;
}
declare class RigidBody {
    readonly id: number;
    mass: number;
    invMass: number;
    inertiaTensorLocal: Mat3;
    invInertiaTensorLocal: Mat3;
    invInertiaTensorWorld: Mat3;
    position: Vec3;
    velocity: Vec3;
    orientation: Quat;
    angularVelocity: Vec3;
    previousPosition: Vec3;
    previousOrientation: Quat;
    force: Vec3;
    torque: Vec3;
    shape: Shape;
    aero: AeroProperties;
    restitution: number;
    friction: number;
    constructor(shape: Shape, mass: number, aero?: Partial<AeroProperties>);
    private _invertDiagonal;
    updateInvInertiaWorld(): void;
    applyForce(f: Vec3): void;
    applyForceAtPoint(f: Vec3, worldPoint: Vec3): void;
    applyTorque(t: Vec3): void;
    clearAccumulators(): void;
    getForwardDir(): Vec3;
    getUpDir(): Vec3;
    getRightDir(): Vec3;
    localToWorld(localVec: Vec3): Vec3;
    worldToLocal(worldVec: Vec3): Vec3;
    savePreviousState(): void;
}

declare class PhysicsWorld {
    bodies: RigidBody[];
    gravity: number;
    rho: number;
    thrustActiveIds: Set<number>;
    private readonly fixedDt;
    private readonly maxSubsteps;
    private accumulator;
    substepsLastFrame: number;
    addBody(body: RigidBody): void;
    removeBody(body: RigidBody): void;
    clear(): void;
    step(dt: number): void;
    getInterpolationAlpha(): number;
    private _substep;
}

declare function applyGravity(body: RigidBody): void;
declare function applyThrust(body: RigidBody): void;
declare function applyAeroDrag(body: RigidBody, rho: number): void;
declare function applyAeroLift(body: RigidBody, rho: number): void;
declare function applyAngularDamping(body: RigidBody, damping?: number): void;

declare function integrate(body: RigidBody, dt: number): void;

interface Contact {
    bodyA: RigidBody;
    bodyB: RigidBody | null;
    point: Vec3;
    normal: Vec3;
    penetration: number;
}
declare function detectCollisions(bodies: RigidBody[]): Contact[];

declare function resolveContacts(contacts: Contact[], dt: number): void;

export { type AeroProperties, type BoxShape, type Contact, Mat3, PhysicsWorld, Quat, RigidBody, type Shape, ShapeType, type SphereShape, Vec3, applyAeroDrag, applyAeroLift, applyAngularDamping, applyGravity, applyThrust, computeInertiaTensor, detectCollisions, integrate, resolveContacts };
