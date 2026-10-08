const fs = require('fs');
const path = require('path');

// Firebase's google-services.json stays out of git. Builds without it still
// work; only parent alerts (push) need it.
module.exports = ({ config }) => {
  if (fs.existsSync(path.join(__dirname, 'google-services.json'))) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  return config;
};
