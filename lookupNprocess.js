const fs = require('fs');
const readline = require('readline');
const { spawn } = require('child_process');

async function processJobs() {
    const targetValues = await readExecuteFile('execute4.txt');

    const fileStream = fs.createReadStream('tmp/chk_4_new.txt');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        const fields = line.split(',');

        if (fields.length >= 3 && targetValues.includes(fields[2].trim())) {
            const jobid = fields[0].trim();

            // Wait for fetchJobId.js to complete
            try {
                await executeNodeScript('fetchJobId.js', jobid);

                // Then run processJobId.js
                await executeNodeScript('processJobId.js', jobid);
            } catch (error) {
                console.error(`Error processing job ${jobid}:`, error);
            }
        }
    }
}

async function readExecuteFile(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    const targetValues = [];
    for await (const line of rl) {
        targetValues.push(line.trim());
    }

    return targetValues;
}

function executeNodeScript(scriptPath, jobid) {
    return new Promise((resolve, reject) => {
        const process = spawn('node', [scriptPath, jobid]);

        process.stdout.on('data', (data) => console.log(`stdout: ${data}`));
        process.stderr.on('data', (data) => console.log(`stderr: ${data}`));

        process.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
            if (code !== 0) {
                reject(new Error(`child process exited with code ${code}`));
            } else {
                resolve();
            }
        });
    });
}

processJobs().catch((err) => console.error(err));
