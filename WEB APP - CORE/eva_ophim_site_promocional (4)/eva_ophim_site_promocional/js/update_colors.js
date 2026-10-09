const fs = require('fs');

// --- evah/home/index.html ---
const htmlFile = 'c:/KazinhoSystems - ArrudaCorp/eva_ophim_site_promocional/evah/home/index.html';
let content = fs.readFileSync(htmlFile, 'utf8');

// Fix dropdown transparent background (var(--surface-bg) does not exist)
content = content.replace(/var\(--surface-bg\)/g, 'var(--bg-elevated)');

// Fix hardcoded rgba(0,0,0,0.05) and rgba(0,0,0,0.1) which look bad in dark mode
content = content.replace(/rgba\(0,0,0,0\.05\)/g, 'var(--surface-border)');
content = content.replace(/rgba\(0,0,0,0\.1\)/g, 'var(--surface-border)');

fs.writeFileSync(htmlFile, content);

// --- evah/sistema/index.html ---
const sysFile = 'c:/KazinhoSystems - ArrudaCorp/eva_ophim_site_promocional/evah/sistema/index.html';
let sysContent = fs.readFileSync(sysFile, 'utf8');

sysContent = sysContent.replace(/var\(--surface-bg\)/g, 'var(--bg-elevated)');
sysContent = sysContent.replace(/rgba\(0,0,0,0\.05\)/g, 'var(--surface-border)');
sysContent = sysContent.replace(/rgba\(0,0,0,0\.1\)/g, 'var(--surface-border)');

fs.writeFileSync(sysFile, sysContent);

// --- css/variables.css ---
// Checking if there's any other contrast issues in variables.css
// Actually, variables.css already has decent light/dark mode settings,
// but let's make sure the drop shadow isn't breaking in light mode.
const varFile = 'c:/KazinhoSystems - ArrudaCorp/eva_ophim_site_promocional/css/variables.css';
let varContent = fs.readFileSync(varFile, 'utf8');

// In light mode, --surface-glass is rgba(255, 255, 255, 0.45). Let's make it a bit more solid so it's readable.
varContent = varContent.replace(/--surface-glass:\s*rgba\(255,\s*255,\s*255,\s*0\.45\);/, '--surface-glass: rgba(255, 255, 255, 0.7);');

fs.writeFileSync(varFile, varContent);
