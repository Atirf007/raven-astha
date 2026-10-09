const fs = require('fs');

const htmlFile = 'c:/KazinhoSystems - ArrudaCorp/eva_ophim_site_promocional/evah/home/index.html';
let content = fs.readFileSync(htmlFile, 'utf8');

// Find the redundant script block at the end
// It starts right after the first </script>
const firstScriptEndIndex = content.indexOf('</script>', content.indexOf('function saveOrgSettings'));

if(firstScriptEndIndex > -1) {
  const redundantStart = content.indexOf('<script src="../../js/auth.js"></script>', firstScriptEndIndex);
  if(redundantStart > -1) {
    const endBody = content.indexOf('</body>', redundantStart);
    if(endBody > -1) {
      content = content.slice(0, redundantStart) + content.slice(endBody);
      fs.writeFileSync(htmlFile, content);
      console.log('Redundant script removed.');
    }
  }
}
