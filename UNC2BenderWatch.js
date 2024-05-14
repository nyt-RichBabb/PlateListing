const chokidar = require('chokidar');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const schedule = require('node-schedule');

const UNC_PATH = '\\\\nwx.nyt.net\\NelaInput';
const LOCAL_PATH = 'c:\\plate-listing\\BenderIn';
const FILES_LIST_PATH = 'tmp\\filesList.json';

const BENDER_IN_DIR = path.join(__dirname, 'BenderIn');
const ERROR_DIR = path.join(__dirname, 'error');
const PUBLIC_DIR = path.join(__dirname, 'public');
const LOG_DIR = path.join(__dirname, 'logs');

const SEPARATION_MAP = {
    C: 'Cyan',
    M: 'Magenta',
    Y: 'Yellow',
    K: 'Black',
};

schedule.scheduleJob('0 11 * * *', function() {
    console.log('Running rotatelogs.js at 11:00 AM...');
    exec('node rotatelogs.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    });
});


const processingQueue = [];
let isProcessing = false;

async function copyWithRetry(src, dest, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await fs.copy(src, dest);
            return;
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(res => setTimeout(res, 1000));
        }
    }
}

let downloadedFiles = {};
if (fs.existsSync(FILES_LIST_PATH)) {
  downloadedFiles = fs.readJsonSync(FILES_LIST_PATH);
}

const watcher = chokidar.watch(UNC_PATH, {
    persistent: true,
    ignoreInitial: true,
    usePolling: true
});

watcher.on('add', async (filePath) => {
    const fileName = path.basename(filePath);
    const localFilePath = path.join(LOCAL_PATH, fileName);
    const fileStats = await fs.stat(filePath);

    if (!downloadedFiles[fileName] || fileStats.mtimeMs > downloadedFiles[fileName].mtimeMs) {
        await new Promise(res => setTimeout(res, 500));
        await copyWithRetry(filePath, localFilePath);
        downloadedFiles[fileName] = { mtimeMs: fileStats.mtimeMs };
        fs.writeJsonSync(FILES_LIST_PATH, downloadedFiles, { spaces: 2 });

        // Add the local file to the processing queue
        processingQueue.push(localFilePath);
        processQueue();
    }
});

console.log(`Watching for changes in ${UNC_PATH}...`);

setInterval(() => {
    exec('c:\\plate-listing\\chk_for_Updates.bat', (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
    });
}, 5 * 60 * 1000);

async function processQueue() {
    if (isProcessing || processingQueue.length === 0) {
        return;
    }
    
    isProcessing = true;
    const filePath = processingQueue.shift();
    
    try {
        // Actual file processing code goes here
        await processFile(filePath);

        // Cleanup: Remove entries older than 24 hours from downloadedFiles
        const twentyFourHoursAgo = getTwentyFourHoursAgo();
        Object.keys(downloadedFiles).forEach((fileName) => {
            if (downloadedFiles[fileName].mtimeMs < twentyFourHoursAgo) {
                delete downloadedFiles[fileName];
            }
        });
        // Update filesList.json
        fs.writeJsonSync(FILES_LIST_PATH, downloadedFiles, { spaces: 2 });
    } catch (error) {
        console.error(`Error processing file ${filePath}: `, error);
    } finally {
        isProcessing = false;
        processQueue();
    }
}

function readPageExcpFile() {
    const pageExcpFile = path.join(__dirname, 'PageExcp.txt');
    const pageExcpContent = fs.readFileSync(pageExcpFile, 'utf8');
    const lines = pageExcpContent.split('\n');
    const pageExcpMap = new Map();

    for (const line of lines) {
        const [pub, page, newPage] = line.trim().split(/\s+/);
        if (pub && page && newPage) {
            const key = `${pub.trim()}_${page.trim()}`;
            pageExcpMap.set(key, newPage.trim());
        }
    }

    return pageExcpMap;
}

async function processFile(filePath) {
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    
    if (!baseName.startsWith('PreBendLi')) {
        moveToError(filePath);
        return;
    }

    const [_, field] = baseName.split(' ');

    const Bdate = field.substring(1, 7);
	
	
 // Updated Bpub calculation
 // let Bpub = field.slice(-4);
 //Bpub = Bpub.replace(/^X+/, '');
 
 // let Bpub = field.slice(21);
 
//Match string at the end of the field that is preceeded
//by "X" Then check for INT.
//
//	"PreBendLine2 2101523XA031bK4099TXXMAIN 20231014145035.ptf" returns "MAIN"
//  "PreBendLine4 4101623TN008bM436Tf1DP 20231015210324.ptf" returns "DP"

// This code will check both the first and second characters from right to left for being integers, and if either of them is an integer, it will use the second integer for the lastDigitPos when there is no "X" in the string.

function determineBpub(field) {
  // Synchronous read from the local file 'execute4.txt'
  const bpubList = fs.readFileSync('execute4.txt', 'utf8');
  const lines = bpubList.split(/\r?\n/); // Split the content by new line to get an array of lines

  // Check if any line in the file matches the end of the field
  for (const line of lines) {
    if (field.endsWith(line)) {
      return line; // If a match is found, return the line and bypass everything else
    }
  }
		
  // Helper function to check if a character is an integer
  const isInteger = (char) => '0123456789'.includes(char);

  // 1. Check for "X" when moving right to left, but ignore if it's within the first 12 characters from the beginning
  let xPos = field.lastIndexOf('X');
  if (xPos !== -1 && xPos < 12) {
    // Ignoring 'X' found within the first 12 characters from the beginning
    xPos = -1;
  }

  if (xPos !== -1) {
    return field.substring(xPos + 1);
  }

  // 2. Find the second integer from the end
  let count = 0;
  for (let i = field.length - 1; i >= 0; i--) {
    if (isInteger(field[i])) {
      count++;
      if (count === 2) {
        // Returning substring just after the second integer from the end
        return field.substring(i + 1);
      }
    }
  }

  return ""; // Default return value if none of the conditions match
}

let Bpub = determineBpub(field);


    const Bpress = field.substring(14, 16);
    const Bsection = field.substring(7, 9);
    let Bpage = field.substring(9, 12);
    const Bseparation = SEPARATION_MAP[field.substring(13, 14)];
	const BpageType = field.substring(12, 13);
	
	// check PageExcp.txt for page exception translation
	// e.g. "VDNQ" Bpage "01a" is tranlated to "001"
	const pageExcpMap = readPageExcpFile();
    const pageExcpKey = `${Bpub}_${Bpage}`;
    if (pageExcpMap.has(pageExcpKey)) {
        Bpage = pageExcpMap.get(pageExcpKey);
    }

    if (!Bdate || !Bpub || !Bpress || !Bsection || !Bpage || !Bseparation) {
        moveToError(filePath);
        return;
    }

    const targetDir = path.join(PUBLIC_DIR, `${Bdate}${Bpub}_Press ${Bpress}`);
    const targetFile = path.join(targetDir, `${Bsection}-${Bpage}.${Bseparation}`);
	
	let hiSide = null;
    if (BpageType === "c") {
        const incrementedBpage = (parseInt(Bpage) + 1).toString().padStart(3, '0');
	    hiSide = path.join(targetDir, `${Bsection}-${incrementedBpage}.${Bseparation}`);
    }
    
if (fs.existsSync(targetDir) && fs.existsSync(targetFile)) {
  fs.unlinkSync(targetFile);
  logProcessedEntry(`${fileName}: ${Bdate}${Bpub}_Press ${Bpress} - ${Bsection}-${Bpage}.${Bseparation}`);
  appendCustomLog(Bdate, Bpub, Bpress, fileName, Bsection, Bpage, Bseparation); 
  
  if (hiSide && fs.existsSync(hiSide)) {
            fs.unlinkSync(hiSide);
            logProcessedEntry(`Deleted ${hiSide} the hiSide of ${Bsection}-${Bpage}.${Bseparation}`);
        }
  
} else {
  logNotProcessedEntry(`${fileName}: ${Bdate}${Bpub}_Press ${Bpress} - ${Bsection}-${Bpage}.${Bseparation}`);

  // Check if ${Bpub} exists in "execute4.txt"
  const execute4File = path.join(__dirname, 'execute4.txt');
  const execute4Content = fs.readFileSync(execute4File, 'utf8');
  const preprocDir = path.join(__dirname, 'tmp', 'preproc', `${Bdate}${Bpub}_Press ${Bpress}`);
  if (execute4Content.includes(Bpub)) {
    // Check if the directory ${Bdate}${Bpub}_Press ${Bpress} exists in "public"
    const publicDir = path.join(PUBLIC_DIR, `${Bdate}${Bpub}_Press ${Bpress}`);
    if (!fs.existsSync(publicDir)) {
      // Create the directory in 'tmp/preproc'
      const preprocDir = path.join(__dirname, 'tmp', 'preproc', `${Bdate}${Bpub}_Press ${Bpress}`);
      if (!fs.existsSync(preprocDir)) {
        fs.mkdirSync(preprocDir, { recursive: true });
      }

      // Copy the file to the 'tmp/preproc' directory
      const preprocFile = path.join(preprocDir, `${Bsection}-${Bpage}.${Bseparation}`);
      fs.copyFileSync(filePath, preprocFile);
      logProcessedEntry(`${fileName}:preproc: ${Bdate}${Bpub}_Press ${Bpress} - ${Bsection}-${Bpage}.${Bseparation}`);
    } else if (fs.existsSync(preprocDir)) {
      // Both "public" and 'tmp/preproc' directories exist
      // Process files from 'tmp/preproc' in "public" if they exist
      const filesInPreproc = fs.readdirSync(preprocDir);
      for (const fileInPreproc of filesInPreproc) {
        const sourceFile = path.join(preprocDir, fileInPreproc);
        const targetFile = path.join(publicDir, fileInPreproc);
        if (fs.existsSync(targetFile)) {
          // If the file already exists in "public", remove it
          fs.unlinkSync(targetFile);
          logProcessedEntry(`File processed from preproc: ${Bdate}${Bpub}_Press ${Bpress}/${fileInPreproc}`);
        }
        // Copy the file to "public"
        //fs.copyFileSync(sourceFile, targetFile);
        //logProcessedEntry(`File copied to public: ${Bdate}${Bpub}_Press ${Bpress}/${fileInPreproc}`);
      }

      // Delete the 'tmp/preproc/${Bdate}${Bpub}_Press ${Bpress}' directory and its contents
      fs.rmSync(preprocDir, { recursive: true });
    }
  }
}
    fs.unlinkSync(filePath);

    await sleep(1000);
}

function getCurrentTimestamp() {
    const now = new Date();
    const date = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
    const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${date} ${time}`;
}

function appendCustomLog(Bdate, Bpub, Bpress, fileName, Bsection, Bpage, Bseparation) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const fileFirstWordLast5 = fileName.split(' ')[0].slice(-5);
  const logString = `[${timestamp}] [${fileFirstWordLast5}] [${Bsection}-${Bpage}.${Bseparation}] `;

  const logFilePath = path.join(__dirname, 'tmp', 'proc', `${Bdate}${Bpub}_Press ${Bpress}`);
  fs.appendFileSync(logFilePath, logString + '\n', { encoding: 'utf8' });
}

function getTwentyFourHoursAgo() {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    return twentyFourHoursAgo.getTime(); // Get the timestamp of 24 hours ago
}

function logProcessedEntry(entry) {
    const logPath = path.join(LOG_DIR, 'bender.log');
    fs.appendFileSync(logPath, `${getCurrentTimestamp()} - processed: ${entry}\n`, { encoding: 'utf8' });
}

function logNotProcessedEntry(entry) {
    const logPath = path.join(LOG_DIR, 'not_processed.log');
    fs.appendFileSync(logPath, `${getCurrentTimestamp()} - not processed: ${entry}\n`, { encoding: 'utf8' });
}

function moveToError(filePath) {
    const fileName = path.basename(filePath);
    const destPath = path.join(ERROR_DIR, fileName);
	// delete instead of move
	fs.unlinkSync(filePath);
    // fs.renameSync(filePath, destPath);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
