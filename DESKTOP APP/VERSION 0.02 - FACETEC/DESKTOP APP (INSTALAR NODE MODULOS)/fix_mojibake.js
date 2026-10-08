const fs = require('fs');
const path = require('path');

const replacements = {
  'Ã§': 'ç', 'Ã£': 'ã', 'Ãµ': 'õ', 'Ã©': 'é', 'Ã­': 'í', 
  'Ã¡': 'á', 'Ã¢': 'â', 'Ãª': 'ê', 'Ã³': 'ó', 'Ãº': 'ú',
  'Ã‡': 'Ç', 'Ãƒ': 'Ã', 'Ã•': 'Õ', 'Ã‰': 'É', 'Ã\x8D': 'Í',
  'Ã\x81': 'Á', 'Ã‚': 'Â', 'ÃŠ': 'Ê', 'Ã“': 'Ó', 'Ãš': 'Ú',
  'Ã§Ã£o': 'ção', 'Ã§Ãµes': 'ções'
};

function fixMojibake(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  for (const [bad, good] of Object.entries(replacements)) {
    if (content.includes(bad)) {
      content = content.split(bad).join(good);
      changed = true;
    }
  }

  if (content.includes('Saida (-)')) {
      content = content.split('Saida (-)').join('Saída (-)');
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed Mojibake in: ' + filePath);
  }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'images' || file === 'fonts') continue;
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath);
        } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js')) {
            fixMojibake(fullPath);
        }
    }
}

walk('C:\\KazinhoSystems - ArrudaCorp\\eva_ophim_site_promocional\\app');
