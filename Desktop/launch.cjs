'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const candidates = [
  path.resolve(__dirname, 'node_modules', 'electron', 'cli.js'),
  path.resolve(__dirname, '..', 'node_modules', 'electron', 'cli.js')
];

const electronCli = candidates.find(candidate => fs.existsSync(candidate));
if (!electronCli) {
  console.error('[ASTHA_ELECTRON] O pacote "electron" ainda não está instalado em node_modules.');
  console.error('Execute "npm install" dentro da pasta electron/ (ou na raiz) para baixar o binário do Electron.');
  process.exit(1);
}

const args = [electronCli, __dirname, ...process.argv.slice(2)];
const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  windowsHide: false
});

child.on('exit', code => {
  process.exit(code ?? 0);
});
