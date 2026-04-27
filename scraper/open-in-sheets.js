'use strict';

// Finds the most recent leads CSV and opens it in Google Sheets automatically
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter(f => f.startsWith('leads-') && f.endsWith('.csv'))
  .map(f => ({ name: f, time: fs.statSync(path.join(dir, f)).mtime }))
  .sort((a, b) => b.time - a.time);

if (!files.length) {
  console.log('No leads CSV found. Run: node scraper.js first.');
  process.exit(1);
}

const latest = path.join(dir, files[0].name);
console.log(`Opening: ${files[0].name}`);
console.log('\nInstructions:');
console.log('1. Go to sheets.new in your browser');
console.log('2. File > Import > Upload > select the CSV below');
console.log('3. Import as: Replace spreadsheet, Separator: Comma\n');
console.log(`File location: ${latest}\n`);

// Open the folder in Windows Explorer
try {
  execSync(`explorer.exe "${dir.replace(/\//g, '\\')}"`);
} catch (e) {}

// Also open sheets.new in the browser
try {
  execSync(`start https://sheets.new`);
} catch (e) {}
