const fs = require('fs');
const request = require('request');
const { spawn } = require('child_process');

const parseReplay = require('./parseReplay.js');


// There are currently ~18413 1v1 replays on rocketleaguereplays.com

// Write streams
const DATASET_ROOT = "D:/rlbot_dataset";
const inputsWriteStream = fs.createWriteStream(`${DATASET_ROOT}/inputs`);
const outputsWriteStream = fs.createWriteStream(`${DATASET_ROOT}/outputs`);
const errorLogStream = fs.createWriteStream(`${DATASET_ROOT}/errorlog.txt`);

let MAX_PARALLEL_PROCESSES = 6; // The maximum number of rattletrap instances running in parallel
const replayStack = []; // contains { url: "", playerTeam: 0 | 1 } objects
let nbParsedReplays = 0;
let doneLoadingPages = false;
let nbParallelProcesses = 0;

// Start data acquisition
const startTime = Date.now();
getReplayPage("https://www.rocketleaguereplays.com/api/replays/");
console.log(`Started acquiring and parsing replays with 'MAX_PARALLEL_PROCESSES' = ${MAX_PARALLEL_PROCESSES}`);

function getReplayPage(url) {
    request.get(url, { timeout: 5000 }, (error, response, body) => {
        if (error) {
            errorLogStream.write(`HTTP request failed with error ${error} on url ${url}. Trying again.\n`);
            return getReplayPage(url); // Try again
        }

        const data = JSON.parse(body);
        data.results.forEach((replay) => {
            if (replay.team_sizes === 1 && replay.match_type === 'Online') { // Only take 1v1 replays
                replayStack.push({ url: replay.file, playerTeam: replay.player_team });
                loadBalancer(); // Spawn a rattletrap instance if not too many are already running
            }
        });

        if (data.next !== null) {
            getReplayPage(data.next);
        } else {
            doneLoadingPages = true;
        }
    });
}

/**
 * If the `nbParallelProcesses` is less than the `MAX_PARALLEL_PROCESSES`, spawn a new rattletrap process with the top replay URL on the stack
 */
function loadBalancer() {
    while (nbParallelProcesses < MAX_PARALLEL_PROCESSES && replayStack.length > 0) {
        downloadAndParseReplay(replayStack.pop());
        nbParallelProcesses++;
    }
}

function downloadAndParseReplay(replay) {
    const rt = spawn('rattletrap', ['decode']);

    parseReplay(rt.stdout, replay.playerTeam, inputsWriteStream, outputsWriteStream);

    rt.stderr.on('data', (data) => {
        errorLogStream.write(`rattletrap error ${data}`);
    });

    rt.on('close', (code) => {
        if (code !== 0) {
            errorLogStream.write(`rattletrap process exited with code ${code} on replay ${replay.url}\n`);
        }

        nbParallelProcesses--;
        nbParsedReplays++;

        if (nbParsedReplays % 100 === 0) {
            console.log(`Parsed ${nbParsedReplays} replays in ${(Date.now() - startTime) / 1000} seconds. Replay stack size: ${replayStack.length}`);
        }

        loadBalancer(); // Continue parsing remaining replays

        // If we are done parsing all the replays, finally close the WriteStreams
        if (doneLoadingPages && replayStack.length === 0 && nbParallelProcesses === 0) {
            inputsWriteStream.close();
            outputsWriteStream.close();
            errorLogStream.close();
            process.exit(0);
        }
    });

    request(replay.url).pipe(rt.stdin); // TODO error handling
}

// Allow dynamically changing 'MAX_PARALLEL_PROCESSES' from the command line by typing a number
process.openStdin().addListener('data', (data) => {
    const parsedNb = parseInt(data.toString().trim(), 10);
    if (!isNaN(parsedNb)) {
        MAX_PARALLEL_PROCESSES = parsedNb;
        console.log(`'MAX_PARALLEL_PROCESSES' was changed to ${parsedNb}`);
    }
});
