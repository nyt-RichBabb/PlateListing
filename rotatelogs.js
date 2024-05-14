const fs = require('fs-extra');
const path = require('path');

const logDir = path.join(__dirname, 'logs');
const prevLogDir = path.join(logDir, 'previous');
const maxVersions = 10;

async function rotateLogFile(filePath) {
    const fileBaseName = path.basename(filePath, path.extname(filePath));
    const fileExt = path.extname(filePath);

    // Increment versions of previously rotated files
    for (let version = maxVersions - 1; version >= 1; version--) {
        const oldPath = path.join(prevLogDir, `${fileBaseName}.${version}${fileExt}`);
        const newPath = path.join(prevLogDir, `${fileBaseName}.${version + 1}${fileExt}`);
        if (await fs.pathExists(oldPath)) {
            await fs.copy(oldPath, newPath, { overwrite: true });
        }
    }

    // Copy current log file as .1 version
    const rotatedPath = path.join(prevLogDir, `${fileBaseName}.1${fileExt}`);
    await fs.copy(filePath, rotatedPath, { overwrite: true });

    // Zero out the original file with retries for 'EBUSY' error
    const retries = 60;
    for (let i = 0; i < retries; i++) {
        try {
            await fs.outputFile(filePath, '');
            return; // Success
        } catch (err) {
            if (err.code === 'EBUSY' && i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second before retrying
            } else {
                throw err; // Re-throw the error if it's not EBUSY or we've run out of retries
            }
        }
    }
}

async function rotateLogs() {
    // Ensure log directories exist
    await fs.ensureDir(logDir);
    await fs.ensureDir(prevLogDir);

    // Get list of log files, excluding subdirectories
    let logFiles = await fs.readdir(logDir);
    logFiles = (await Promise.all(logFiles.map(async file => {
        const filePath = path.join(logDir, file);
        const stat = await fs.stat(filePath);
        return stat.isFile() && file !== 'previous' ? file : undefined;
    }))).filter(file => file);

    // Rotate each log file
    for (const file of logFiles) {
        const filePath = path.join(logDir, file);
        try {
            await rotateLogFile(filePath);
        } catch (err) {
            console.error(`Error rotating log file ${file}:`, err);
            // Continue with the next file
        }
    }

    // Clean up old log files in 'previous' directory
    const rotatedFiles = await fs.readdir(prevLogDir);
    const regex = new RegExp(`\.${maxVersions + 1}\.`);
    const toDelete = rotatedFiles.filter(file => regex.test(file));

    for (const file of toDelete) {
        await fs.remove(path.join(prevLogDir, file));
    }
}

rotateLogs()
    .then(() => console.log('Log rotation complete.'))
    .catch(err => console.error('Error rotating logs:', err));
