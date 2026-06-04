const exec = require('child_process').exec;

async function execute(command){
  return new Promise((resolve, reject) => {
    exec(command, function(error, stdout){
      console.log(stdout);
      if (error) return reject(error);
      return resolve();
    });
  });
}

async function run() {
  let cmd = 'cp -R assets build/';
  if (process.platform === 'win32') cmd = 'xcopy assets build\\assets\\ /s /e /y';
  await execute(cmd);  

  cmd = 'cp package.json build/package.json';
  if (process.platform === 'win32') cmd = 'copy package.json build\\package.json';
  await execute(cmd);

  const noticeFiles = ['LICENSE', 'THIRD-PARTY-NOTICES.md'];
  for (const file of noticeFiles) {
    cmd = `cp ${file} build/${file}`;
    if (process.platform === 'win32') cmd = `copy ${file} build\\${file}`;
    await execute(cmd);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(-1);
})
