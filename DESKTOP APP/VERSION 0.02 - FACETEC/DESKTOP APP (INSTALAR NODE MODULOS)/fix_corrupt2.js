const fs = require('fs');
const path = require('path');

function replaceCorrupt(text) {
    let t = text;
    t = t.replace(/voc\uFFFD/g, 'você');
    t = t.replace(/Voc\uFFFD/g, 'Você');
    t = t.replace(/Autentica\uFFFD\uFFFD/g, 'Autenticação');
    t = t.replace(/Autentica\uFFFD.o/g, 'Autenticação');
    t = t.replace(/autentica\uFFFD.o/g, 'autenticação');
    t = t.replace(/A\uFFFD.o/g, 'Ação');
    t = t.replace(/a\uFFFD.o/g, 'ação');
    t = t.replace(/Informa\uFFFD.es/g, 'Informações');
    t = t.replace(/Configura\uFFFD.es/g, 'Configurações');
    t = t.replace(/Padr\uFFFD.o/g, 'Padrão');
    t = t.replace(/Gest\uFFFD.o/g, 'Gestão');
    t = t.replace(/Organiza\uFFFD.o/g, 'Organização');
    t = t.replace(/Relat\uFFFDrios/g, 'Relatórios');
    t = t.replace(/Usu\uFFFDrio/g, 'Usuário');
    t = t.replace(/L\uFFFDder/g, 'Líder');
    t = t.replace(/Armaz\uFFFDm/g, 'Armazém');
    t = t.replace(/M\uFFFDdulo/g, 'Módulo');
    t = t.replace(/Vis\uFFFD.o/g, 'Visão');
    t = t.replace(/Sincroniza\uFFFD.o/g, 'Sincronização');
    t = t.replace(/Integra\uFFFD.es/g, 'Integrações');
    t = t.replace(/Sa\uFFFDe/g, 'Saúde');
    t = t.replace(/Op\uFFFD.o/g, 'Opção');
    t = t.replace(/Op\uFFFD.es/g, 'Opções');
    t = t.replace(/Aten\uFFFD.o/g, 'Atenção');
    t = t.replace(/N\uFFFDvel/g, 'Nível');
    t = t.replace(/M\uFFFDs/g, 'Mês');
    t = t.replace(/Fa\uFFFD.a/g, 'Faça');
    t = t.replace(/Hist\uFFFDrico/g, 'Histórico');
    
    // Replace all remaining \uFFFD with '?' just in case
    t = t.replace(/\uFFFD/g, '?'); 
    return t;
}

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && file !== 'node_modules') {
            processDir(fullPath);
        } else if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.css')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('\uFFFD')) {
                const fixed = replaceCorrupt(content);
                if (content !== fixed) {
                    fs.writeFileSync(fullPath, fixed, 'utf8');
                    console.log('Fixed corrupt text in', file);
                }
            }
        }
    }
}

processDir(path.join(__dirname, 'app'));
