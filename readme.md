# RLBot-Dataset

This project parses all 1v1 Rocket League replay files on [rocketleaguereplays.com](https://www.rocketleaguereplays.com) using [Rattletrap](https://github.com/tfausak/rattletrap) and generates a large dataset of inputs (ball and cars positions and velocities) as well as outputs (car controls) for use in training Machine Learning models.

These data points are recorded at a rate of 10 per second (although that can be changed in the [code](/parseReplay.js#L12)) and can be used to train twice, once for each player (Blue Car information always comes first in the data).

> This project is still very much a work-in-progress. Do not trust all the values in the generated dataset files. This is especially true for the 'balance' car outputs. Any help is appreciated!

When time permits, I will upload the latest generated datasets on some file sharing website. In the meantime, you can easily generate your own in a few hours by running the `index.js` file with Node.

Note that the dataset binary files are fairly large and total about 6 GB.

## Binary files description

It was decided to generate binary files for this dataset in order to minimize the size of the generated files.

For a complete description of the contents of the "inputs" and "outputs" generated files, please check out the [IO page](/io.md).

## Running the code

You will need to have installed:
- Node v7 or higher
- Rattletrap

To start the dataset generation process, simply run `node index.js`.

Some values to consider changing before running (there are no command line arguments yet):
- `DATASET_ROOT` to specify where to generate the output files.
- `MAX_PARALLEL_PROCESSES` to change the maximum number of concurrent Rattletrap processes running at once.

I have found `MAX_PARALLEL_PROCESSES = 6` to be a reasonable number for my computer but your mileage may vary. Too large of a number and the code will run even slower.
In addition to manually changing this value in the code, you can type it as an integer number in the console at any time while this project is running in order to dynamically change the number of parallel processes running. I have found `2` to be a reasonable number to allow me to take a break and play Rocket League without frame drops!

## Current Issues

- Car 'balance' (think y-axis of left joystick) currently seems impossible to retrieve from replay files, with the exception of when a player is dodging.
- The program sometimes will not stop on its own. If this ever happens to you, simply forcefully stop it and the dataset files should still be intact.

## Error File

This program will also generate an `errorlog.txt` file containing all the Rattletrap errors that occured when parsing the replays.
