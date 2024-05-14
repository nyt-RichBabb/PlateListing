const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter text to hash: ', (input) => {
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  console.log(`256-bit Hash: ${hash}`);
  rl.close();
});