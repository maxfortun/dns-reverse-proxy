'use strict';
var debug = require('debug')('dns-reverse-proxy:lib:config:local:debug');

const fs = require('fs');
var path = require('path');

let json = fs.readFileSync(path.join(__dirname, '..', 'local', 'config.json'));

module.exports = JSON.parse(json);
debug(module.exports);

