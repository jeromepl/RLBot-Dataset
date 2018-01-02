const fs = require('fs');
const JSONStream = require('JSONStream');
const es = require('event-stream');

const { RigidBody, Car } = require('./replayObjects.js');


// To test with a local file:
// const replayStream = fs.createReadStream('res/test3.json', { encoding: 'utf8' });
// parseReplay(replayStream);

const RECORDING_FPS = 10;

// player1Team is used to know which team the first car (player1) belongs to and to output team0 (blue) always first
function parseReplay(replayStream, player1Team, inputsWriteStream, outputsWriteStream) {
    const rigidBodies = {
        ball: new RigidBody(),
        player1: new Car(),
        player2: new Car()
    };

    let startRecording = false; // Wait for game to actually start (timer at 0s) before recording
    let timeSinceLastSnapshot = 0;
    
    // Read stream
    const parser = JSONStream.parse('content.frames.*');
    const readStream = replayStream.pipe(parser);

    readStream.on('close', () => {
        if (!startRecording) {
            console.log("Stream ended without recording anything. No match start detected.");
        }
    });
    
    // Stream each frame since replay files can be really big
    readStream.pipe(es.mapSync(function (frame) { 

        const newRecordingFrame = startRecording && timeSinceLastSnapshot > 1 / RECORDING_FPS;
        // After N frames, take a snapshot of the replay objects' values
        if (newRecordingFrame) {
            if (inputsWriteStream) {
                const ballInputBuffer = rigidBodies.ball.getInputBuffer();
                const player1InputBuffer = rigidBodies.player1.getInputBuffer();
                const player2InputBuffer = rigidBodies.player2.getInputBuffer();
                inputsWriteStream.write(ballInputBuffer);
                inputsWriteStream.write((player1Team === 0)? player1InputBuffer : player2InputBuffer);
                inputsWriteStream.write((player1Team === 0)? player2InputBuffer : player1InputBuffer);
                
                const totalLength = ballInputBuffer.length + player1InputBuffer.length + player2InputBuffer.length;
            }
            if (outputsWriteStream) {
                const player1OutputBuffer = rigidBodies.player1.getOutputBuffer();
                const player2OutputBuffer = rigidBodies.player2.getOutputBuffer();
                outputsWriteStream.write((player1Team === 0)? player1OutputBuffer : player2OutputBuffer);
                outputsWriteStream.write((player1Team === 0)? player2OutputBuffer : player1OutputBuffer);

                const totalLength = player1OutputBuffer.length + player2OutputBuffer.length;
            }

            timeSinceLastSnapshot = 0;
        }

        timeSinceLastSnapshot += frame.delta;

        // Update all rigid bodies' state
        frame.replications.forEach((replication) => {
            // Check if the game has started (skip the wait time at the start)
            if (!startRecording && replication.value.updated_replication_value) {
                replication.value.updated_replication_value.forEach((updatedReplicationValue)=> {
                    if (updatedReplicationValue.name === 'TAGame.GameEvent_TA:ReplicatedGameStateTimeRemaining' && updatedReplicationValue.value.int_attribute_value === 0) {
                        startRecording = true;
                    }
                });
            }

            // Update the ball and cars objects
            updateRigidBodiesFromReplication(replication, rigidBodies, frame.delta, newRecordingFrame);
        });
    }));
};

function updateRigidBodiesFromReplication(replication, rigidBodies, delta, newRecordingFrame) {

    // --- RIGID BODY INITIALIZATION --- //
    if (replication.value.spawned_replication_value) {
        // If there is a spawned replication value, assign the actorID to the corresponding rigid body
        switch(replication.value.spawned_replication_value.object_name) {
            case 'Archetypes.Ball.Ball_Default':
                rigidBodies.ball.setInitialActorID(replication.actor_id.value);
                break;
            case 'Archetypes.Car.Car_Default':
                const actorID = replication.actor_id.value;
                setInitialPlayer1Then2("actorID", actorID, rigidBodies);
                break;
            case 'Archetypes.CarComponents.CarComponent_Boost':
                const boostActorID = replication.actor_id.value;
                setInitialPlayer1Then2("boostActorID", boostActorID, rigidBodies);
                break;
            
            // All the following objects are used to track jumps
            case 'Archetypes.CarComponents.CarComponent_Jump':
                const jumpActorID = replication.actor_id.value;
                setInitialPlayer1Then2("jumpActorID", jumpActorID, rigidBodies);
                break;
            case 'Archetypes.CarComponents.CarComponent_DoubleJump':
                const doubleJumpActorID = replication.actor_id.value;
                setInitialPlayer1Then2("doubleJumpActorID", doubleJumpActorID, rigidBodies);
                break;
            case 'Archetypes.CarComponents.CarComponent_Dodge':
                const dodgeActorID = replication.actor_id.value;
                setInitialPlayer1Then2("dodgeActorID", dodgeActorID, rigidBodies);
                break;
            case 'Archetypes.CarComponents.CarComponent_FlipCar':
                const flipActorID = replication.actor_id.value;
                setInitialPlayer1Then2("flipActorID", flipActorID, rigidBodies);
                break;
        }
    }

    // --- RIGID BODY UPDATE --- //
    const replicationValue = replication.value.updated_replication_value;
    if (replicationValue) {

        // Update rigid body states
        Object.keys(rigidBodies).forEach((rigidBodyName) => {
            const rigidBody = rigidBodies[rigidBodyName];
            const actorID = rigidBody.actorID;
            if (replication.actor_id.value !== actorID) {
                return;
            }

            replicationValue.forEach((valueUpdated) => {
                if (valueUpdated.name === 'TAGame.RBActor_TA:ReplicatedRBState') { // Rigid Body state of ball or player was updated
                    const rigidBodyState = valueUpdated.value.rigid_body_state_attribute_value;
                    // The variable above contains the following (useful) keys:
                    // linear_velocity, angular_velocity, location, rotation
                    // These all contain three values: x, y and z
                    rigidBody.setState(rigidBodyState);
                }
            });
        });

        // Car-specific components
        let dodging = false;
        [rigidBodies.player1, rigidBodies.player2].forEach((player) => {
            // Check for jump button pressed
            ['jumpActorID', 'doubleJumpActorID', 'dodgeActorID', 'flipActorID'].forEach((actorIDKey) => {
                if (player[actorIDKey] && player[actorIDKey] === replication.actor_id.value) {
                    replicationValue.forEach((updatedReplicationValue) => {
                        if (updatedReplicationValue.name === 'TAGame.CarComponent_TA:ReplicatedActive') {
                            // Odd values means the player pressed the jump button, even values means he/she released it
                            player.jumping = updatedReplicationValue.value.byte_attribute_value % 2 === 1;

                            if (actorIDKey === 'dodgeActorID' && updatedReplicationValue.value.byte_attribute_value % 2 === 1) {
                                dodging = true;
                            }
                        }
                    });
                }
            });

            // Check for boost value (input) and boost button pressed (output)
            if (player.boostActorID && player.boostActorID === replication.actor_id.value) {
                replicationValue.forEach((updatedReplicationValue) => {
                    if (updatedReplicationValue.name === 'TAGame.CarComponent_Boost_TA:ReplicatedBoostAmount') {
                        player.setBoostValue(updatedReplicationValue.value.byte_attribute_value);
                    } else {
                        // Since boost value is not updated in every frame while a player is boosting, manually update its value
                        // based on whether or not the player is currently boosting.
                        // Note that this is done before checking 'boosting' because the first frame where a player starts boosting should not count towards boost lost.
                        player.updateBoostValue(delta);
                    }
                    
                    if (updatedReplicationValue.name === 'TAGame.CarComponent_TA:ReplicatedActive') {
                        // Odd values means the player started boosting, even values means he/she stopped boosting or ran out of boost
                        player.boosting = updatedReplicationValue.value.byte_attribute_value % 2 === 1;
                    }
                });
            }

            // Check for powerslide, steer and throttle (on the main car Actor)
            if (player.actorID && player.actorID === replication.actor_id.value) {
                replicationValue.forEach((updatedReplicationValue) => {
                    if (updatedReplicationValue.name === 'TAGame.Vehicle_TA:ReplicatedSteer') {
                        player.steerValue = updatedReplicationValue.value.byte_attribute_value; // 128 = no steer, 0 = full left, 255 = full right
                    }
                    else if (updatedReplicationValue.name === 'TAGame.Vehicle_TA:ReplicatedThrottle') {
                        player.throttleValue = updatedReplicationValue.value.byte_attribute_value; // 128 = no throttle, 0 = full backward, 255 = full forward
                    }
                    else if (updatedReplicationValue.name === 'TAGame.Vehicle_TA:bReplicatedHandbrake') {
                        player.powersliding = updatedReplicationValue.value.boolean_attribute_value;
                    }
                });
            }

            // TODO No idea how to get y-axis of left joystick. Doesn't appear to be stored in replay files
            // For now at least, when dodging we can get a direction from the 'DodgeTorque'
            if (newRecordingFrame) {
                player.balanceValue = 128; // Make sure to reset every time the states are recorded
            }
            if (dodging && player.dodgeActorID && player.dodgeActorID === replication.actor_id.value) {
                replicationValue.forEach((updatedReplicationValue) => {
                    if (updatedReplicationValue.name === 'TAGame.CarComponent_Dodge_TA:DodgeTorque') {
                        player.balanceValue = Math.sign(updatedReplicationValue.value.location_attribute_value.y) * 127 + 128;
                        // Results in 3 possibles values: 1 (close enough to 0), 128, or 255 (most common, when dodging forward)
                    }
                });
            }
        });
    }
}

/**
 * Set a value for Player 1 first, then, on the second call, set a value for Player 2 (if the value is not the one of Player 1).
 * Used to set actorID belonging to each car in sequential order.
*/
function setInitialPlayer1Then2(property, value, rigidBodies) {
    if (rigidBodies.player1[property] !== undefined && rigidBodies.player1[property] !== value) {
        rigidBodies.player2[property] = value;
    } else {
        rigidBodies.player1[property] = value;
    }
}

module.exports = parseReplay;
