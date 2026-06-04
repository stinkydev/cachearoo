const fs = require('fs');
const path = require('path');

fs.rm(path.join(__dirname, 'build'), { recursive: true, force: true }, () => {});
