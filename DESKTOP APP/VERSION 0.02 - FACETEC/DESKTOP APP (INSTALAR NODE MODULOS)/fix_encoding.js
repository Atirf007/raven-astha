const fs = require('fs');
const path = require('path');

function fixMojibake(text) {
    // A simple regex to detect utf-8 interpreted as latin1
    // Ã£ -> ã, Ã§ -> ç, etc.
    try {
        // If it contains "Ã", it likely has mojibake.
        if (text.includes('Ã')) {
            // Buffer.from(string, 'latin1') takes the 1-to-1 byte mapping
            return Buffer.from(text, 'latin1').toString('utf8');
        }
    } catch(e) {}
    return text;
}

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && file !== 'node_modules') {
            processDir(fullPath);
        } else if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.css')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const fixed = fixMojibake(content);
            if (content !== fixed) {
                fs.writeFileSync(fullPath, fixed, 'utf8');
                console.log('Fixed encoding in', file);
            }
        }
    }
}

processDir(path.join(__dirname, 'app'));
processDir(path.join(__dirname, 'api'));
