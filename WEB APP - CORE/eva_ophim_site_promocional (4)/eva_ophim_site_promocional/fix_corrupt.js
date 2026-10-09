const fs = require('fs');
const path = require('path');

function replaceCorrupt(text) {
    // Manually fixing common corrupted words
    let t = text;
    t = t.replace(/voc/g, 'você');
    t = t.replace(/Voc/g, 'Você');
    t = t.replace(/Autentica.o/g, 'Autenticação');
    t = t.replace(/autentica.o/g, 'autenticação');
    t = t.replace(/A.o/g, 'Ação');
    t = t.replace(/a.o/g, 'ação');
    t = t.replace(/informa.es/g, 'informações');
    t = t.replace(/Informa.es/g, 'Informações');
    t = t.replace(/Configura.es/g, 'Configurações');
    t = t.replace(/configura.es/g, 'configurações');
    t = t.replace(/Padro/g, 'Padrão');
    t = t.replace(/Gesto/g, 'Gestão');
    t = t.replace(/gesto/g, 'gestão');
    t = t.replace(/Organiza.o/g, 'Organização');
    t = t.replace(/organiza.o/g, 'organização');
    t = t.replace(/Relatrios/g, 'Relatórios');
    t = t.replace(/Usurio/g, 'Usuário');
    t = t.replace(/usurio/g, 'usuário');
    t = t.replace(/Lder/g, 'Líder');
    t = t.replace(/Armazm/g, 'Armazém');
    t = t.replace(/armazm/g, 'armazém');
    t = t.replace(/Mdulo/g, 'Módulo');
    t = t.replace(/mdulo/g, 'módulo');
    t = t.replace(/viso/g, 'visão');
    t = t.replace(/Viso/g, 'Visão');
    t = t.replace(/Sincroniza.o/g, 'Sincronização');
    t = t.replace(/Integra.es/g, 'Integrações');
    t = t.replace(/Sade/g, 'Saúde');
    t = t.replace(/Op.o/g, 'Opção');
    t = t.replace(/op.es/g, 'opções');
    t = t.replace(/Op.es/g, 'Opções');
    t = t.replace(/Aten.o/g, 'Atenção');
    t = t.replace(/aten.o/g, 'atenção');
    t = t.replace(/Nvel/g, 'Nível');
    t = t.replace(/nvel/g, 'nível');
    t = t.replace(/Ms/g, 'Mês');
    t = t.replace(/ms/g, 'mês');
    t = t.replace(/Voc./g, 'Você'); // catchall for voc.
    t = t.replace(/Fa.a/g, 'Faça');
    t = t.replace(/fa.a/g, 'faça');
    t = t.replace(/Hist.rico/g, 'Histórico');
    
    // Replace all remaining  with empty string if not matched above
    t = t.replace(//g, ''); 
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
            // If it actually contains the Unicode replacement char
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
