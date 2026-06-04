/* eslint-disable no-console */
const { exec } = require('child_process');

function execute(command, callback) {
  exec(command, (error, stdout) => {
    console.log(stdout);
    if (error) return callback(error);
    return callback(null);
  });
}

const cmd = 'npm run build';

execute(cmd, (err) => {
  if (err) {
    console.log(err);
    process.exit(-1);
  }
  console.log('done');
});
