const fs = require('fs');
const path = require('path');
const { withEntitlementsPlist } = require('expo/config-plugins');

// iOS push needs a paid Apple developer team (Batyr's, M4V4D8KSX3) and an APNs
// key to deliver. A free personal team can't sign the Push capability at all,
// so builds signed by one must leave it out: set IOS_PUSH=0 for those.
const withoutIosPush = (config) =>
  withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });

// Firebase's google-services.json stays out of git. Builds without it still
// work; only parent alerts (push) need it.
module.exports = ({ config }) => {
  if (fs.existsSync(path.join(__dirname, 'google-services.json'))) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  return process.env.IOS_PUSH === '0' ? withoutIosPush(config) : config;
};
