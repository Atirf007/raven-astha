const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && file !== 'node_modules') {
            processDir(fullPath);
        } else if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.css')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;
            
            // Remove leading '?' (which was a corrupted BOM)
            if (content.startsWith('?')) {
                content = content.substring(1);
                changed = true;
            }
            
            // Fix Faǟa and other specific heavily mangled strings
            if (content.includes('Faǟa')) { content = content.replace(/Faǟa/g, 'Faça'); changed = true; }
            if (content.includes('Faa')) { content = content.replace(/Faa/g, 'Faça'); changed = true; }
            if (content.includes('Gestǟo')) { content = content.replace(/Gestǟo/g, 'Gestão'); changed = true; }
            
            if (changed) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Fixed file:', file);
            }
        }
    }
}

processDir(path.join(__dirname, 'app'));
processDir(path.join(__dirname, 'api'));
