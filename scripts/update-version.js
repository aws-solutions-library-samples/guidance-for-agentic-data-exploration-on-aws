#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Support testing with different directory
const baseDir = process.env.TEST_DIR || path.join(__dirname, '..');

// Read package.json to get current version
const packagePath = path.join(baseDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const version = packageJson.version;

// Create version info for Python app
const versionInfo = {
  version: version,
  build_date: new Date().toISOString(),
  git_commit: process.env.GITHUB_SHA || 'local-dev'
};

// Write version file for Python app
const versionFilePath = path.join(baseDir, 'docker', 'app', 'version.json');
fs.writeFileSync(versionFilePath, JSON.stringify(versionInfo, null, 2));

// Write version file for UI
const uiVersionFilePath = path.join(baseDir, 'ui', 'version.json');
fs.writeFileSync(uiVersionFilePath, JSON.stringify(versionInfo, null, 2));

console.log(`Version ${version} info written to version files`);