const fs = require('fs');
const path = require('path');

fs.copyFileSync(path.join(__dirname, 'config-windows.json'),
  path.join(__dirname, 'build', 'config.json'));
