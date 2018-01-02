class RigidBody {

    constructor() {
        this.state = { // Initial state
            location: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            linear_velocity: { x: 0, y: 0, z: 0 },
            angular_velocity: { x: 0, y: 0, z: 0 }
        };
    }

    setState(state) {
        Object.assign(this.state.location, state.location);
        Object.assign(this.state.rotation, state.rotation);
        Object.assign(this.state.linear_velocity, state);
        Object.assign(this.state.angular_velocity, state.angular_velocity);
    }

    setInitialActorID(actorID) {
        if (this.actorID === undefined) {
            this.actorID = actorID;
        }
    }

    /**
     * Generate a buffer from the state.
     * The buffer has the following format: 12 16-bit integers in this order:
     * location_x, location_y, location_z,
     * rotation_x, rotation_y, rotation_z,
     * linear_velocity_x, linear_velocity_y, linear_velocity_z,
     * angular_velocity_x, angular_velocity_y, angular_velocity_z
     */
    getInputBuffer() {
        const locationBuffer = Buffer.from(new Int32Array([
            this.state.location.x,
            this.state.location.y,
            this.state.location.z
        ]).buffer);
        const rotationBuffer = Buffer.from(new Uint16Array([
            this.state.rotation.x.value,
            this.state.rotation.y.value,
            this.state.rotation.z.value
        ]).buffer);
        const linearVelocityBuffer = Buffer.from(new Int32Array([
            this.state.linear_velocity.x,
            this.state.linear_velocity.y,
            this.state.linear_velocity.z
        ]).buffer);
        const angularVelocityBuffer = Buffer.from(new Int32Array([
            this.state.angular_velocity.x,
            this.state.angular_velocity.y,
            this.state.angular_velocity.z
        ]).buffer);

        const totalLength = locationBuffer.length + rotationBuffer.length + linearVelocityBuffer.length + angularVelocityBuffer.length;
        return Buffer.concat([locationBuffer, rotationBuffer, linearVelocityBuffer, angularVelocityBuffer], totalLength);
    }
}

const BOOST_CONSUMPTION_RATE = 85; // 85/255 per second

class Car extends RigidBody {

    // Properties of this object:
    // this.state (from RigidBody parent)
    // this.steerValue
    // this.throttleValue
    // this.balanceValue -- y-axis of the left joystick. TODO figure out how to get this value from the replay files
    // this.boostValue
    // this.boosting -- Whether the boost key is currently pressed
    // this.boostActorID
    // this.powersliding -- a.k.a handbrake
    // this.jumping -- Whether the jump key is currently pressed
    // this.jumpActorID
    // this.jumpActorID
    // this.doubleJumpActorID -- Double jumps are saved separately (but in addition to) than the single jumps
    // this.dodgeActorID -- A dodge happens when double jumping while the left joystick is pointed in some direction
    // this.flipActorID -- A flip happens when a car is upside down and the player presses the jump button to flip over

    constructor() {
        super();
        this.boostValue = 0;
        this.boosting = false;
        this.jumping = false;
        this.powersliding = false;
        this.steerValue = 128; // 128 = no steer, 0 = full left, 255 = full right
        this.throttleValue = 128; // 128 = no throttle, 0 = full backward, 255 = full forward
        this.balanceValue = 128; // 128 = centered joystick, 0 = joystick pointing down, 255 = joystick pointing up
    }

    setBoostValue(boostValue) {
        this.boostValue = boostValue;
    }

    updateBoostValue(delta) {
        if (this.boosting) {
            this.boostValue -= delta * BOOST_CONSUMPTION_RATE;
            this.boostValue = Math.max(0, this.boostValue);
        }
    }

    getInputBuffer() {
        const rigidBodyBuffer = super.getInputBuffer();
        const boostBuffer = Buffer.from(new Uint8Array([this.boostValue]).buffer); // Will trim any decimal value
        const totalLength = rigidBodyBuffer.length + boostBuffer.length;
        return Buffer.concat([rigidBodyBuffer, boostBuffer], totalLength);
    }

    getOutputBuffer() {
        const arr = new Uint8Array([this.throttleValue, this.steerValue, this.balanceValue, this.boosting, this.jumping, this.powersliding]); // boolean values become '0' or '1'
        return Buffer.from(arr.buffer);
    }
}

module.exports = {
    RigidBody,
    Car
};
