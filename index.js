const express = require('express');
const fs = require('fs').promises; // Use promise API
const fsSync = require('fs'); // For synchronous operations
const path = require('path');
const cron = require('node-cron');
const crypto = require('crypto'); // Import crypto module
const WebSocket = require('ws');
const Server = WebSocket.Server; // This is the correct way to get the Server class
const { spawn } = require('child_process');
const readline = require('readline'); 
const { Tail } = require('tail');

const app = express();
const IP = '0.0.0.0'; 
const PORT = 80;

const server = app.listen(PORT, IP, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Bender logs view
//const wss = new Server({ server });
const wssBender = new Server({ noServer: true });
const wssNotProcessed = new Server({ noServer: true });


// Handling bender.log connections
wssBender.on('connection', async socket => {
    console.log("Client connected to WebSocket for bender.log.");
    let logPath = path.join(__dirname, 'logs', 'bender.log');
    try {
        let lastLines = await readLastNLines(logPath, 10);
        socket.send(lastLines.join("\n"));
    } catch (error) {
        console.error("ERROR reading last lines from bender.log:", error);
    }
    // Add tail logic for bender.log here
});

// Handling not_processed.log connections
wssNotProcessed.on('connection', async socket => {
    console.log("Client connected to WebSocket for not_processed.log.");
    let logPath = path.join(__dirname, 'logs', 'not_processed.log');
    try {
        let lastLines = await readLastNLines(logPath, 10);
        socket.send(lastLines.join("\n"));
    } catch (error) {
        console.error("ERROR reading last lines from not_processed.log:", error);
    }
    // Add tail logic for not_processed.log here
});

// Upgrade HTTP server to WebSocket server
server.on('upgrade', function upgrade(request, socket, head) {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

    if (pathname === '/bender') {
        wssBender.handleUpgrade(request, socket, head, function done(ws) {
            wssBender.emit('connection', ws, request);
        });
    } else if (pathname === '/not_processed') {
        wssNotProcessed.handleUpgrade(request, socket, head, function done(ws) {
            wssNotProcessed.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});


// Function to read the last N lines from a file
async function readLastNLines(filePath, n) {
    const fileStream = fsSync.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    let lines = [];
    for await (const line of rl) {
        lines.push(line);
        if (lines.length > n) {
            lines.shift();
        }
    }
    return lines;
}


app.use(express.static('public'));
app.use(express.json()); // Parse JSON body

const PUBLIC_PATH = path.join(__dirname, 'public');
const LOG_PATH = path.join(__dirname, 'logs');

const USERS = {
    press: { password: "8690de39507caeeee662d39c61d5ac51c4364ae0b534b56b48314d5717d545ca", level: "level2" },
    admin: { password: "8f3fd7a5d4d071cc024be542270cc66bec435f3742521fe9c1001c864ed0ba33", level: "level3" }
};

//Level1 password without a username.
const HASHED_PASSWORD = '3b56c3520006aaeb038c24862bcde877284bc1654e73bda292d90db943c4573d';

// CRON JOBS
//=============
// Check for incomplete CMYK set every 5 minutes
cron.schedule('*/5 * * * *', async () => {await checkAndDeleteFiles();});
// Schedule the function to run daily old JOB delete at 11:30 AM
cron.schedule('30 11 * * *', async () => { await deleteOldFoldersAndLog();});
//=============

// Check and delete file groupings that do not contain a .black
// This usually means a color position changed to B&W and the .black was 
// processed.  If the black plate was processed over 5 minutes ago,
// delete the unprocessed separations and log deletions.

const checkAndDeleteFiles = async () => {
    //console.log("Function checkAndDeleteFiles called");

    try {
        const directories = await fs.readdir(PUBLIC_PATH, { withFileTypes: true });
        //console.log(`Read directories in ${PUBLIC_PATH}`);

        for (const dirent of directories) {
            if (!dirent.isDirectory()) continue;
            //console.log(`Processing directory: ${dirent.name}`);

            const dirPath = path.join(PUBLIC_PATH, dirent.name);
            const files = await fs.readdir(dirPath);
            //console.log(`Files in ${dirPath}: ${files.join(', ')}`);

            const fileGroups = files.reduce((acc, file) => {
                const prefix = file.split('.')[0].toLowerCase();
                acc[prefix] = acc[prefix] || { cyan: false, magenta: false, yellow: false, black: false };
                const lowerCaseFile = file.toLowerCase();
                if (lowerCaseFile.endsWith('.cyan')) acc[prefix].cyan = true;
                if (lowerCaseFile.endsWith('.magenta')) acc[prefix].magenta = true;
                if (lowerCaseFile.endsWith('.yellow')) acc[prefix].yellow = true;
                if (lowerCaseFile.endsWith('.black')) acc[prefix].black = true;
                return acc;
            }, {});

            for (const [prefix, filePresence] of Object.entries(fileGroups)) {
                //console.log(`Checking file group: ${prefix}`);

                if (filePresence.cyan && filePresence.magenta && filePresence.yellow && !filePresence.black) {
                    console.log(`Incomplete file group found for prefix ${prefix}`);
                    const procFilePath = path.join(__dirname, 'tmp', 'proc', dirent.name);
                    //console.log(`procFilePath: ${procFilePath}`);

                    if (fsSync.existsSync(procFilePath)) {
                        console.log(`Processing file exists for ${dirent.name}`);
                        try {
                            const fileDescriptor = fsSync.openSync(procFilePath, 'r');
                            const buffer = Buffer.alloc(1024); // Adjust buffer size as needed
                            let fileContent = '';

                            while (true) {
                                const bytesRead = fsSync.readSync(fileDescriptor, buffer, 0, buffer.length, null);
                                if (bytesRead === 0) {
                                    break; // No more data to read
                                }
                                fileContent += buffer.slice(0, bytesRead).toString('utf8');
                            }

                            fsSync.closeSync(fileDescriptor);

                            const matchingLine = fileContent.split('\n').find(line => line.toLowerCase().includes(`${prefix}.black`));

                            if (matchingLine) {
    console.log(`Matching line found for ${prefix}.black`);
    const timestampMatch = matchingLine.match(/\[(\d{2}:\d{2}:\d{2} [AP]M)\]/);

    if (timestampMatch && timestampMatch[1]) {
        const timestamp = timestampMatch[1];
        const timeParts = timestamp.split(/[: ]/); // Split by colon and space

        const now = new Date();
        let hours = parseInt(timeParts[0]);

        // Adjust hours for AM/PM
        if (timeParts[3] === 'PM' && hours < 12) hours += 12;
        if (timeParts[3] === 'AM' && hours === 12) hours = 0;

        const logDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, parseInt(timeParts[1]), parseInt(timeParts[2]));

        const timeDifference = now - logDate;
        console.log(`Time difference: ${timeDifference}`);
		
		if (new Date() - logDate > 5 * 60 * 1000) { // More than 5 minutes old
                                // Delete corresponding color files and log
                                ['cyan', 'magenta', 'yellow'].forEach(async (color) => {
                                    const colorFilePath = path.join(dirPath, `${prefix}.${color}`);
                                    if (fsSync.existsSync(colorFilePath)) {
                                        await fs.unlink(colorFilePath);
										console.log(`Auto-deleted file: ${colorFilePath}`);
                                        const logMessage = `${new Date().toLocaleString()} - Auto-deleted file: ${colorFilePath}\n`;
                                        await fs.appendFile(path.join(LOG_PATH, 'autodeleted.log'), logMessage);
                                    }
                                });
                            }
		
		
    } else {
        console.error(`Invalid timestamp format in line: ${matchingLine}`);
    }

                            }
                        } catch (readFileError) {
                            console.error(`Error reading proc file for ${dirent.name}: ${readFileError.message}`);
                        }
                    } else {
                        console.error(`Processing file does not exist for ${dirent.name}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Error in checkAndDeleteFiles: ${error.message}`);
    }
};


// Helper function to check if a folder is older than specified 5 hours
const isOlderThanHours = (folderPath, hours) => {
  const folderStat = fsSync.statSync(folderPath);
  const folderAge = (new Date() - folderStat.mtime) / (1000 * 60 * 60); // Convert age to hours
  return folderAge > hours;
};

// Function to delete old folders (5 hours and matching today's date) and log the action
const deleteOldFoldersAndLog = async () => {
  const today = new Date();
  const todayFormatted = `${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}${today.getFullYear().toString().slice(-2)}`;

  try {
    const folders = await fs.readdir(PUBLIC_PATH, { withFileTypes: true });
    for (const folder of folders) {
      if (!folder.isDirectory() || !folder.name.startsWith(todayFormatted)) continue;

      const folderPath = path.join(PUBLIC_PATH, folder.name);
      if (isOlderThanHours(folderPath, 5)) {
        await fs.rm(folderPath, { recursive: true });
        const logEntry = `${new Date().toLocaleString()} - Deleted folder: ${folderPath}\n`;
        await fs.appendFile(path.join(LOG_PATH, "daily_job_delete.log"), logEntry);
      }
    }
  } catch (error) {
    console.error(`Error in deleteOldFoldersAndLog: ${error.message}`);
  }
};


async function createDoneDirectories() {
    const items = await fs.readdir(PUBLIC_PATH, { withFileTypes: true });

    for (const item of items) {
        if (!item.isDirectory() || !item.name.includes("Press")) continue;

        const dirPath = path.join(PUBLIC_PATH, item.name);

        // Check if the directory exists (it might have been deleted)
        if (!fsSync.existsSync(dirPath)) continue;

        // Check if the directory is empty
        try {
            if ((await fs.readdir(dirPath)).length === 0) {
                // create "Done" dir and "-" file
                await fs.mkdir(path.join(dirPath, 'Done'), { recursive: true });
                await fs.writeFile(path.join(dirPath, 'Done', '-'), '');
                await fs.appendFile(path.join(LOG_PATH, 'created_Done'), `${item.name} at ${new Date().toLocaleString()}\n`);
            }
        } catch (err) {
            console.error(`Error while handling directory ${item.name}: ${err}`);
        }
    }
}

async function containsNoFilesTopLevel(dirPath) {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
        if (item.isFile()) return false; // If a file is found, directory contains files
    }
    return true; // If no files are found in the top level, then it contains no files
}

async function deleteOldDirectories() {
    const items = await fs.readdir(PUBLIC_PATH, { withFileTypes: true });
    const currentTime = new Date();

    for (const item of items) {
        if (!item.isDirectory() || !item.name.includes("Press")) continue;

        const dirPath = path.join(PUBLIC_PATH, item.name);
        
        try {
            const stat = await fs.stat(dirPath);
            
            if (await containsNoFilesTopLevel(dirPath) && currentTime - stat.mtime > 1 * 60 * 60 * 1000 && fsSync.existsSync(dirPath)) {
                // Directory is older than 24 hours, contains no files at the top level, and exists, so delete it
                await fs.rm(dirPath, { recursive: true });
                await fs.appendFile(path.join(LOG_PATH, 'expired_lists'), `Deleted: ${item.name} at ${new Date().toLocaleString()}\n`);
            }
        } catch (err) {
            console.error(`Error while checking/deleting directory ${item.name}: ${err}`);
        }
    }
}

function generateHash(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function getDirectoryContents(dirPath, depth = 0) {
    return new Promise(async (resolve, reject) => {
        if (depth > 10) {
            resolve([]);
            return;
        }

        let items;
        try {
            items = await fs.readdir(dirPath, { withFileTypes: true });
        } catch (err) {
            reject(err);
            return;
        }

        let collapseDirectory = items.some(item => item.name === '-');
        const promises = items.map(async item => {
            if (item.isDirectory()) {
                const subDirContents = await getDirectoryContents(path.join(dirPath, item.name), depth + 1);
                const stat = await fs.stat(path.join(dirPath, item.name));
                return {
                    name: item.name,
                    type: 'directory',
                    contents: subDirContents,
                    fileCount: subDirContents.reduce((acc, cur) => acc + (cur.type === 'file' ? 1 : 0), 0),
                    collapse: collapseDirectory,
                    modifyTime: Math.floor(stat.mtimeMs / 1000)
                };
            } else {
                return {
                    name: item.name,
                    type: 'file'
                };
            }
        });

        try {
            const results = await Promise.all(promises);
            resolve(results.filter(item => !(item.type === 'directory' && item.contents.length === 0)));
        } catch (err) {
            reject(err);
        }
    });
}

// Function to read the last line of a file
function readLastLine(filePath) {
    return new Promise((resolve, reject) => {
        let stream = fsSync.createReadStream(filePath, {
            flags: 'r',
            encoding: 'utf8',
            fd: null,
            mode: 0o666,
            autoClose: true
        });

        let data = '';
        let lastLine = '';
        stream.on('data', (chunk) => {
            data += chunk;
            let lines = data.split('\n');
            lastLine = lines[lines.length - 2];
            data = lines[lines.length - 1];
        });

        stream.on('end', () => resolve(lastLine));
        stream.on('error', (err) => reject(err));
    });
}


app.get('/get-directories', async (req, res) => {
    await createDoneDirectories();
    await deleteOldDirectories();
	
    getDirectoryContents(PUBLIC_PATH).then(async directories => {
        // Process each directory to include the LastProcessed data
        for (let dir of directories) {
            if (dir.type === 'directory') {
                let lastProcessedFile = path.join(__dirname, 'tmp', 'proc', dir.name);
                if (fsSync.existsSync(lastProcessedFile)) {
                    dir.lastProcessed = await readLastLine(lastProcessedFile);
                } else {
                    dir.lastProcessed = null;
                }
            }
        }
        res.send(directories);
    }).catch(err => res.status(500).send({ error: "Unable to scan directory" }));
});

// Route to get the log file content
// const fsPromises = require('fs').promises;

//app.get('/get-log', async (req, res) => {
//  try {
//    const logFilePath = path.join(__dirname, 'logs', 'bender.log');
//    const data = await fsPromises.readFile(logFilePath, 'utf8');
//    res.send(data);
//  } catch (err) {
//    res.status(500).send('Error reading log file');
//  }
//});



app.post('/clear-directory', (req, res) => {
    const dirPath = path.join(__dirname, 'public', req.body.directoryName);

    fs.readdir(dirPath)
        .then(files => {
            // Use Promise.all to wait for all files to be deleted
            return Promise.all(files.map(file => fs.unlink(path.join(dirPath, file))));
        })
        .then(() => {
            res.status(200).send('Directory cleared successfully');
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Failed to clear directory');
        });
});

app.post('/delete-files', async (req, res) => {
    try {
        const { files: filesToDelete, directoryName } = req.body;
        if (!directoryName) {
            throw new Error('Directory name is missing');
        }

        for (const file of filesToDelete) {
            const filePath = path.join(PUBLIC_PATH, directoryName, file);
            await fs.unlink(filePath);

            // Log the deletion with a timestamp
            const timestamp = new Date().toLocaleString();
            const logMessage = `${timestamp} - Deleted file: ${filePath}\n`;
            await fs.appendFile(path.join(LOG_PATH, 'manually_deleted.log'), logMessage);
        }
        res.status(200).send({ message: 'Files deleted successfully' });
    } catch (error) {
        console.error('Error deleting files:', error);
        res.status(500).send({ message: 'Error deleting files' });
    }
});


// authenticate endpoint
app.post("/authenticate", async (req, res) => {
    let { username, password } = req.body;
    
    if (!password) {
        return res.status(400).send({ error: "Password is required" });
    }

    let hashedPassword = generateHash(password);

    if (username && USERS[username]) {
        if (USERS[username].password === hashedPassword) {
            return res.status(200).send({ authenticated: true, level: USERS[username].level });
        }
    } else {
        // For level1 (basic authentication with only password)
        if (HASHED_PASSWORD === hashedPassword) {
            return res.status(200).send({ authenticated: true, level: "level1" });
        }
    }

    return res.status(401).send({ authenticated: false });
});



app.post('/delete-directory', (req, res) => {
    const { directoryName } = req.body;

    fs.rm(path.join(PUBLIC_PATH, directoryName), { recursive: true })
        .then(() => {
            fs.appendFile(path.join(LOG_PATH, 'expired_lists'), `Deleted: ${directoryName} at ${new Date().toLocaleString()}\n`)
                .catch(err => console.error(`Failed to log deletion: ${err}`));
            res.send({ success: true });
        })
        .catch(err => {
            console.error(err);
            res.status(500).send({ error: 'Failed to delete directory' });
        });
});

//app.listen(PORT, IP, () => {
//    console.log(`Server is running on http://localhost:${PORT}`);
//});
