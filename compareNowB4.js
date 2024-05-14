const fs = require('fs');

const readLines = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(`Error reading file from disk: ${err}`);
      } else {
        resolve(data.split('\n'));
      }
    });
  });
};

const findNewLines = (nowLines, beforeLines) => {
  return nowLines.filter(line => !beforeLines.includes(line));
};

const showNewLines = (newLines) => {
  if (newLines.length > 0) {
    console.log('New lines found:');
    newLines.forEach(line => console.log(line));
  } else {
    console.log('No new lines found.');
  }
};

const compareFilesAndShowNewLines = async () => {
  try {
    const [nowLines, beforeLines] = await Promise.all([
      readLines('./tmp/now.txt'),
      readLines('./tmp/before.txt'),
    ]);
    const newLines = findNewLines(nowLines, beforeLines);
    showNewLines(newLines);
  } catch (error) {
    console.error(error);
  }
};

compareFilesAndShowNewLines();
