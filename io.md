# IO

The dataset consists of two binary files, one for the "inputs" and one for the "outputs".

The outputs files are named 'inputs' and 'outputs' because of how they are expected to be used in a Machine Learning algorithm. For example, the 'inputs' can be fed into a neural network and trained with the expected 'outputs'. However, it is totally possible that your usage requires a different configuration, for example if you were trying to predict the position of the ball.

Here, the "inputs" are defined as being the location, rotation and velocity of each car and of the ball. Note that cars also have a boost value.
The "outputs" only apply to cars and contain the different controls that a player executed such as throttle, steer, balance (WIP), jumping, powersliding and boosting.

**Note that the cars are always in the same order: Blue team first, then Orange team.**

## Inputs

**The Inputs file contains the following:**
Each set of **128 bytes** corresponds to a single data point consisting of the following (in this order):
- 42 bytes for the Ball inputs
- 2 * 43 bytes for the Car inputs

Each set of 43 bytes (42 for the Ball) contains the following (also in this order):

| Inputs                    | Range            | Byte Count |
|---------------------------|------------------|------------|
| location.x                | Signed Integer   | 4          |
| location.y                | Signed Integer   | 4          |
| location.z                | Signed Integer   | 4          |
| rotation.x                | 0 - 65535        | 2          |
| rotation.y                | 0 - 65535        | 2          |
| rotation.z                | 0 - 65535        | 2          |
| linear_velocity.x         | Signed Integer   | 4          |
| linear_velocity.y         | Signed Integer   | 4          |
| linear_velocity.z         | Signed Integer   | 4          |
| angular_velocity.x        | Signed Integer   | 4          |
| angular_velocity.y        | Signed Integer   | 4          |
| angular_velocity.z        | Signed Integer   | 4          |
| boost  (not for Ball)     | 0 - 255          | 1          |

## Outputs

**The Outputs file contains the following:**
Each set of **12 bytes** corresponds to a single data point consisting of the following:
- 2 * 6 bytes for the Car inputs
- There are no outputs for the Ball as it cannot be controlled.

Each set of 6 bytes contains the following (in this order):

| Inputs           | Range       | Byte Count | Replay file constant                               |
|------------------|-------------|------------|----------------------------------------------------|
| steer            | 0 - 255     | 1          | TAGame.Vehicle_TA:ReplicatedSteer                  |
| throttle         | 0 - 255     | 1          | TAGame.Vehicle_TA:ReplicatedThrottle               |
| balance          | 0 - 255     | 1          | ???                                                |
| jumping          | 0 - 1       | 1          | _See note below_                                   |
| powersliding     | 0 - 1       | 1          | TAGame.Vehicle_TA:bReplicatedHandbrake             |
| boosting         | 0 - 1       | 1          | TAGame.CarComponent_Boost_TA:ReplicatedBoostAmount |

***TODO* 'balance' (left joystick y-axis) = ??**

**Jump** is tricky: Actors 11 (Jump), 12 (Double-jump), 13 (Dodge) and 14 (Flip car) all come into effect.

**Note** that in order to save storage space, jump, powerslide and boost **could** all be stored in a single byte:
```javascript
const byte = (jump << 2) | (powerslide << 1) | boost;
```