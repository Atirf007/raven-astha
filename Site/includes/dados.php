<?php
// Conteúdo do site em um lugar só. Os textos e números saíram da documentação do TCC
// (Documentacao_TCC_Raven_Astah_2026) e dos dados de teste do laboratório (seed-local-lab.js).

// todo botão de baixar leva pro repositório do projeto
$repositorio = 'https://github.com/Atirf007/raven-astha';

$numeros = [
    ['valor' => 15.5, 'casas' => 1, 'sufixo' => '%', 'texto' => 'do PIB brasileiro foi gasto com logística em 2024', 'fonte' => 'ILOS, 2026'],
    ['valor' => 584, 'casas' => 0, 'prefixo' => 'R$ ', 'sufixo' => ' bi', 'texto' => 'só em armazenagem, movimentação interna e estoques', 'fonte' => 'Lima; Lobo, 2024'],
    ['valor' => 65, 'casas' => 0, 'sufixo' => '%', 'texto' => 'do custo operacional de um armazém vem da separação (picking)', 'fonte' => 'Águia Sistemas, 2023'],
    ['valor' => 5.8, 'casas' => 1, 'sufixo' => '%', 'texto' => 'da receita anual se perde com erro de inventário e falta de peça', 'fonte' => 'Zebra; Oxford Economics, 2026'],
];

$modulos = [
    'corporativo' => [
        'nome' => 'Corporativo',
        'icone' => 'bi-buildings',
        'cor' => '#9861f2',
        'resumo' => 'Cada empresa fica isolada no seu workspace. Pessoas, convites, grupos de acesso e organograma ficam num lugar só.',
        'itens' => ['Dados da empresa e identidade visual', 'Convites com código e validade', 'Grupos RBAC: administrador, operador, técnico e leitor', 'Organograma com cargos e chefias'],
        'tela' => 'usuarios',
    ],
    'wms' => [
        'nome' => 'WMS Core',
        'icone' => 'bi-box-seam',
        'cor' => '#2563eb',
        'resumo' => 'Cadastro de materiais (MM01), entradas e saídas (MIGO) com transação no banco e um mapa 2D/3D que mostra a prateleira certa.',
        'itens' => ['Dashboard com itens críticos e valor em estoque', 'Endereço físico: corredor, prateleira e nível', 'Saída bloqueada se o saldo não cobre', 'Editor CAD e visualizador 3D em Three.js'],
        'tela' => 'wms-dashboard',
    ],
    'eam' => [
        'nome' => 'Manutenção e Análises',
        'icone' => 'bi-gear-wide-connected',
        'cor' => '#06b6d4',
        'resumo' => 'Ficha técnica das máquinas, ordens de serviço, preventivas por tempo ou horímetro e os números de confiabilidade calculados sozinhos.',
        'itens' => ['Ficha do ativo com Digital Twin', 'OS corretiva e preventiva com peças do estoque', 'MTBF, MTTR e disponibilidade', 'Pareto, Kaplan-Meier e Weibull 2P'],
        'tela' => 'confiabilidade',
    ],
    'pessoal' => [
        'nome' => 'Modo Pessoal',
        'icone' => 'bi-house-heart',
        'cor' => '#10b981',
        'resumo' => 'O mesmo motor 3D, só que para a casa: cômodos, móveis com gavetas e a pergunta que todo mundo já fez, "onde eu deixei isso?".',
        'itens' => ['Cômodos montados em 3D', 'Pertences por móvel e gaveta', 'Agenda de tarefas da casa', 'Busca "Encontrar com IA"'],
        'tela' => 'pessoal-3d',
    ],
];

// telas reais do web app (capturadas do sistema rodando com os dados do laboratório)
$telasWeb = [
    ['arquivo' => 'login', 'modulo' => 'acesso', 'titulo' => 'Login', 'texto' => 'Entrada por e-mail e senha, com recuperação por código de segurança.'],
    ['arquivo' => 'cadastro', 'modulo' => 'acesso', 'titulo' => 'Cadastro', 'texto' => 'Escolha entre conta corporativa ou pessoal logo no primeiro passo.'],
    ['arquivo' => 'onboarding-cargos', 'modulo' => 'acesso', 'titulo' => 'Onboarding corporativo', 'texto' => 'Cargos iniciais da equipe antes de criar o workspace.'],
    ['arquivo' => 'launchpad', 'modulo' => 'wms', 'titulo' => 'Launchpad', 'texto' => 'Atalhos dos módulos e os avisos do que precisa de atenção hoje.'],
    ['arquivo' => 'visao-estoques', 'modulo' => 'wms', 'titulo' => 'Visão dos estoques', 'texto' => 'Saldo, valor e movimentação por período, com gráficos.'],
    ['arquivo' => 'wms-dashboard', 'modulo' => 'wms', 'titulo' => 'Dashboard do WMS', 'texto' => 'Itens críticos, distribuição e valor em estoque (R$ 5.813,50 no laboratório).'],
    ['arquivo' => 'wms-estoque', 'modulo' => 'wms', 'titulo' => 'Catálogo de estoque', 'texto' => 'Tabela de materiais com local, saldo, preço e status.'],
    ['arquivo' => 'novo-material', 'modulo' => 'wms', 'titulo' => 'Novo material (MM01)', 'texto' => 'Cadastro técnico em abas: básico, imagem 3D, maquinário e documentos.'],
    ['arquivo' => 'detalhe-material', 'modulo' => 'wms', 'titulo' => 'Ficha do material', 'texto' => 'Saldo, limites, posição na prateleira e anexos.'],
    ['arquivo' => 'entrada', 'modulo' => 'wms', 'titulo' => 'Entrada (MIGO)', 'texto' => 'Registro de entrada com nota fiscal e preço unitário.'],
    ['arquivo' => 'mapa-3d', 'modulo' => 'wms', 'titulo' => 'Central de mapas 3D', 'texto' => 'O galpão inteiro em 3D, com as prateleiras ocupadas.'],
    ['arquivo' => 'editor-cad', 'modulo' => 'wms', 'titulo' => 'Editor CAD', 'texto' => 'Planta 2D e perspectiva 3D lado a lado, com publicação por revisão.'],
    ['arquivo' => 'componentes', 'modulo' => 'wms', 'titulo' => 'Componentes (BOM)', 'texto' => 'Kits de peças com custo total calculado.'],
    ['arquivo' => 'ativos', 'modulo' => 'eam', 'titulo' => 'Ativos', 'texto' => 'Hierarquia de máquinas: linha, bomba, motor subordinado.'],
    ['arquivo' => 'ficha-ativo', 'modulo' => 'eam', 'titulo' => 'Ficha do ativo', 'texto' => 'Estrutura, componentes, Digital Twin, documentos e histórico.'],
    ['arquivo' => 'ordens', 'modulo' => 'eam', 'titulo' => 'Ordens de serviço', 'texto' => 'Corretivas e preventivas, com status e prioridade.'],
    ['arquivo' => 'preventivas', 'modulo' => 'eam', 'titulo' => 'Preventivas', 'texto' => 'Calendário do mês e planos por intervalo ou horímetro.'],
    ['arquivo' => 'confiabilidade', 'modulo' => 'eam', 'titulo' => 'Confiabilidade', 'texto' => 'Paradas, disponibilidade, MTBF e MTTR por equipamento.'],
    ['arquivo' => 'pareto', 'modulo' => 'analises', 'titulo' => 'Pareto', 'texto' => 'Horas perdidas por causa, com percentual acumulado.'],
    ['arquivo' => 'kaplan-meier', 'modulo' => 'analises', 'titulo' => 'Kaplan-Meier', 'texto' => 'Curva de sobrevivência com intervalo de confiança e população em risco.'],
    ['arquivo' => 'weibull', 'modulo' => 'analises', 'titulo' => 'Weibull 2P', 'texto' => 'Forma β 1,96 e escala η 1.649,92 h nas vidas de rolamentos.'],
    ['arquivo' => 'relatorios', 'modulo' => 'analises', 'titulo' => 'Relatórios', 'texto' => 'Histórico de movimentações com filtro e exportação CSV.'],
    ['arquivo' => 'assistente', 'modulo' => 'analises', 'titulo' => 'Assistente ASTHA', 'texto' => 'Consulta rápida sobre estoque e movimentações.'],
    ['arquivo' => 'usuarios', 'modulo' => 'corporativo', 'titulo' => 'Equipe e acessos', 'texto' => 'Pessoas, cargos e papel de acesso de cada uma.'],
    ['arquivo' => 'corporativo', 'modulo' => 'corporativo', 'titulo' => 'Organização', 'texto' => 'Dados da empresa, capa do workspace e filiais.'],
    ['arquivo' => 'pessoal-3d', 'modulo' => 'pessoal', 'titulo' => 'Espaços 3D', 'texto' => 'O quarto montado em 3D, com cama, armário e cômoda.'],
    ['arquivo' => 'pessoal-moveis', 'modulo' => 'pessoal', 'titulo' => 'Móveis 3D', 'texto' => 'Biblioteca de móveis de cada espaço.'],
    ['arquivo' => 'pessoal-pertences', 'modulo' => 'pessoal', 'titulo' => 'Meus pertences', 'texto' => 'Cada coisa no seu lugar, com situação: guardado, emprestado, não encontrado.'],
    ['arquivo' => 'pessoal-agenda', 'modulo' => 'pessoal', 'titulo' => 'Agenda', 'texto' => 'Tarefas da casa com repetição e prioridade.'],
    ['arquivo' => 'pessoal-ia', 'modulo' => 'pessoal', 'titulo' => 'Encontrar com IA', 'texto' => '"Onde deixei o passaporte?" — e a resposta aponta o móvel.'],
];

$filtrosWeb = [
    'todos' => 'Todas',
    'acesso' => 'Acesso',
    'wms' => 'WMS Core',
    'eam' => 'Manutenção',
    'analises' => 'Análises',
    'corporativo' => 'Corporativo',
    'pessoal' => 'Pessoal',
];

$telasMobile = [
    ['arquivo' => 'login', 'titulo' => 'Login'],
    ['arquivo' => 'launchpad', 'titulo' => 'Launchpad'],
    ['arquivo' => 'estoques', 'titulo' => 'Visão dos estoques'],
    ['arquivo' => 'estoque', 'titulo' => 'Estoque'],
    ['arquivo' => 'detalhe-material', 'titulo' => 'Detalhe do material'],
    ['arquivo' => 'entrada', 'titulo' => 'Entrada'],
    ['arquivo' => 'mapa-3d', 'titulo' => 'Mapa 3D'],
    ['arquivo' => 'mapa-2d', 'titulo' => 'Mapa 2D'],
    ['arquivo' => 'ordens', 'titulo' => 'Ordens de serviço'],
    ['arquivo' => 'confiabilidade', 'titulo' => 'Confiabilidade'],
    ['arquivo' => 'conexao', 'titulo' => 'Central de conexão'],
    ['arquivo' => 'menu', 'titulo' => 'Menu'],
    ['arquivo' => 'pessoal-espacos', 'titulo' => 'Espaços (pessoal)'],
    ['arquivo' => 'pessoal-pertences', 'titulo' => 'Pertences (pessoal)'],
    ['arquivo' => 'pessoal-agenda', 'titulo' => 'Agenda (pessoal)'],
    ['arquivo' => 'cadastro', 'titulo' => 'Cadastro'],
];

// números do equipamento LAB-BOMBA-P1 entre 03/09 e 03/10/2026 (laboratório)
$bomba = [
    'operacao' => 711,
    'parada' => 9,
    'falhas' => 3,
    'mtbf' => 237,
    'mttr' => 1.5,
    'disponibilidade' => 98.75,
];

$pareto = [
    ['causa' => 'Rolamento', 'horas' => 14],
    ['causa' => 'Selo mecânico', 'horas' => 8],
    ['causa' => 'Desalinhamento', 'horas' => 5],
    ['causa' => 'Lubrificação', 'horas' => 3],
    ['causa' => 'Filtro', 'horas' => 2],
    ['causa' => 'Elétrica', 'horas' => 1],
];

$weibull = ['beta' => 1.9561, 'eta' => 1649.92];

// onde cada material do laboratório está guardado no armazém (prateleira-nível-posição)
$localizacoes = [
    ['codigo' => 'LAB-MAT-1', 'material' => 'Rolamento', 'local' => 'A1-N1-P1', 'saldo' => 24, 'status' => 'ok'],
    ['codigo' => 'LAB-MAT-2', 'material' => 'Selo mecânico', 'local' => 'A1-N2-P2', 'saldo' => 1, 'status' => 'minimo'],
    ['codigo' => 'LAB-MAT-3', 'material' => 'Filtro', 'local' => 'A2-N3-P1', 'saldo' => 0, 'status' => 'zerado'],
    ['codigo' => 'LAB-MAT-4', 'material' => 'Correia', 'local' => 'B1-N1-P1', 'saldo' => 15, 'status' => 'ok'],
    ['codigo' => 'LAB-MAT-5', 'material' => 'Óleo', 'local' => 'B2-N2-P3', 'saldo' => 40, 'status' => 'ok'],
];

$requisitosFuncionais = [
    'A. Corporativo e governança (RBAC)' => [
        'Gestão da organização e identidade visual' => 'O administrador cadastra e edita razão social, nome fantasia, CNPJ, fuso horário e moeda, e escolhe o tema (escuro, claro ou automático) e a cor de destaque.',
        'Gestão de pessoas e convites' => 'Cadastrar colaboradores, listar membros ativos, suspender acessos e gerar convites, vinculando cada pessoa à empresa (workspace_id), setor e cargo.',
        'Grupos de acesso e segregação de permissões' => 'O que cada pessoa vê ou altera é controlado por grupos: Administradores, Operadores de Estoque, Técnicos/Engenheiros de Manutenção e Visualizadores.',
        'Estrutura organizacional e organograma' => 'Cadastro de setores e cargos com vínculos de chefia, montando o organograma na tela.',
    ],
    'B. WMS Core e mapeamento 2D/3D' => [
        'Autenticação unificada e Launchpad' => 'Login por e-mail e senha, com código de recuperação, abrindo o Launchpad com atalhos e avisos de estoque baixo.',
        'Dashboard de indicadores' => 'Valor total em estoque, quantidade de materiais, itens que precisam de reposição urgente e distribuição por categoria.',
        'Catálogo e cadastro técnico de materiais' => 'Cadastrar, editar, pesquisar e inativar materiais com SKU único por empresa, categoria, unidade, preço, estoque mínimo, ponto de pedido, fornecedor e endereço físico.',
        'Movimentações de entrada e saída' => 'Entradas (compra, devolução, ajuste) e saídas (manutenção, retirada interna), conferindo saldo antes e salvando quem fez, quando e por quê.',
        'Central de mapas e visualizador 2D/3D' => 'Editor 2D da planta (zonas, corredores, prateleiras) e visualizador 3D que mostra a ocupação e destaca o material pesquisado.',
        'Componentes e lista técnica (BOM)' => 'Vincular materiais às máquinas onde são usados como peça de reposição, com a quantidade necessária em cada equipamento.',
    ],
    'C. Manutenção (EAM) e Estúdio de Análises' => [
        'Cadastro e ficha técnica de ativos' => 'Máquinas com TAG, criticidade (A, B ou C), fabricante, modelo, localização, componentes, modelo 3D (Digital Twin) e histórico.',
        'Ordens de serviço' => 'Abrir, acompanhar e concluir OS corretivas e preventivas: prioridade, defeito, causa, tempo de reparo, peças usadas e situação.',
        'Manutenção preventiva' => 'Planos por intervalo de tempo ou horas de uso, com checklist de revisão.',
        'Indicadores de confiabilidade' => 'MTBF, MTTR e disponibilidade calculados automaticamente a partir das ordens registradas.',
        'Estúdio de análises estatísticas' => 'Pareto (curva ABC), Kaplan-Meier, Weibull de dois parâmetros, taxa de falha por idade e acompanhamento de temperatura.',
        'Relatórios e Assistente ASTHA' => 'Relatórios salvos para consulta futura e um chat interno para dúvidas rápidas e consulta de dados.',
    ],
    'D. Modo Pessoal (organização doméstica 2D/3D)' => [
        'Espaços e móveis em 2D/3D' => 'Criar cômodos, posicionar móveis com divisórias internas e ver tudo em 3D.',
        'Catálogo de pertences e busca com IA' => 'Guardar objetos e documentos indicando cômodo, móvel e gaveta, com a busca "Encontrar com IA" mostrando o móvel no mapa 3D.',
        'Offline e central de conexão no mobile' => 'Dados salvos em SQLite no celular para continuar trabalhando sem sinal e sincronizar quando a conexão voltar.',
    ],
];

$requisitosNaoFuncionais = [
    ['icone' => 'bi-key', 'titulo' => 'Senhas e sessão', 'texto' => 'Senhas com hash bcrypt, nunca em texto puro. Rotas protegidas por JWT com expiração e código único de recuperação.'],
    ['icone' => 'bi-diagram-3', 'titulo' => 'Multitenant', 'texto' => 'Todas as tabelas e consultas filtram pelo workspace_id. Uma empresa não enxerga os dados de outra.'],
    ['icone' => 'bi-shield-check', 'titulo' => 'LGPD', 'texto' => 'Só os dados necessários, exclusão lógica para preservar a auditoria e registro de quem alterou o quê (Lei nº 13.709/2018).'],
    ['icone' => 'bi-laptop', 'titulo' => 'Multiplataforma', 'texto' => 'Web, Desktop com Electron (Windows e Linux testados) e Mobile com Flutter (Android testado). macOS e iOS ficaram sem teste por falta de hardware Apple.'],
    ['icone' => 'bi-speedometer2', 'titulo' => 'Desempenho', 'texto' => 'Modelos 3D leves em WebGL e respostas da API abaixo de 300 ms em rede local.'],
    ['icone' => 'bi-palette', 'titulo' => 'Contraste e cores', 'texto' => 'Contraste mínimo de 4,5:1 (WCAG 2.1 AA). Azul-ardósia no fundo para cansar menos a vista em turnos longos.'],
    ['icone' => 'bi-arrow-repeat', 'titulo' => 'Transações ACID', 'texto' => 'Saldo do material e linha do histórico gravados juntos. Se algo falha no meio, o MySQL desfaz tudo (rollback).'],
];

$casosDeUso = [
    'UC01' => 'Realizar login e recuperar acesso',
    'UC02' => 'Realizar onboarding corporativo ou pessoal',
    'UC03' => 'Cadastrar e consultar material no estoque (MM01)',
    'UC04' => 'Registrar movimentação de entrada e saída (MIGO)',
    'UC05' => 'Mapear e localizar itens na central de mapas 2D/3D',
    'UC06' => 'Gerenciar componentes e lista técnica (BOM)',
    'UC07' => 'Cadastrar e inspecionar ativo industrial e Digital Twin',
    'UC08' => 'Abrir, executar e encerrar ordem de serviço',
    'UC09' => 'Gerenciar planos preventivos e confiabilidade',
    'UC10' => 'Executar estudos no Estúdio de Análises',
    'UC11' => 'Consultar relatórios e Assistente ASTHA',
    'UC12' => 'Gerenciar organização, pessoas e grupos RBAC',
    'UC13' => 'Gerenciar perfil do usuário e segurança da conta',
    'UC14' => 'Modelar espaços e móveis 2D/3D no Modo Pessoal',
    'UC15' => 'Catalogar pertences e localizar objeto com IA',
    'UC16' => 'Operar offline e sincronizar no aplicativo mobile',
];

$cronograma = [
    ['fase' => 'Fundamentação e arquitetura', 'itens' => ['Pesquisa em ILOS, CNI, Sebrae e Zebra', 'Definição dos módulos', 'Paleta de cores e WCAG', 'Requisitos, termo de abertura, Canvas e casos de uso']],
    ['fase' => 'Etapa 01 – Estrutura', 'itens' => ['Banco MySQL 8.0 com workspace_id e ACID', 'API de autenticação, onboarding e RBAC', 'API de estoque, manutenção e análises']],
    ['fase' => 'Etapa 02 – Interface, Electron e Flutter', 'itens' => ['Telas web e empacotamento Electron', 'Editor 2D e visualizador 3D em Three.js', 'App Flutter com SQLite e central de conexão', 'Integração geral']],
    ['fase' => 'Refinamento e estabilização', 'itens' => ['Seed do laboratório (seed-local-lab.js)', 'Testes em Windows, Linux e Android', 'Ajustes de contraste e desempenho 3D']],
    ['fase' => 'Finalização e entrega', 'itens' => ['Documentação final com telas reais', 'Roteiro de demonstração para a banca']],
];

$tecnologias = [
    'Back-end e servidor' => [
        ['Node.js e JavaScript (ES2023)', 'Servidor e regras de negócio.'],
        ['API RESTful modular', 'JSON para login, WMS, EAM, análises, corporativo e pessoal.'],
        ['Motor estatístico próprio', 'Pareto, Kaplan-Meier e Weibull 2P.'],
    ],
    'Banco de dados' => [
        ['MySQL 8.0', 'Banco principal, transações ACID e separação por workspace_id.'],
        ['SQLite', 'Banco local do celular e fila de sincronização offline.'],
        ['Migrações e seed', 'Criação das tabelas e dados de laboratório.'],
    ],
    'Front-end, desktop e mobile' => [
        ['HTML5, CSS3 e JavaScript', 'Telas web e desktop com tema claro e escuro.'],
        ['Electron', 'Programa instalável para Windows e Linux.'],
        ['Three.js (WebGL) e Canvas 2D', 'Armazém, Digital Twin, cômodos, editor 2D e gráficos.'],
        ['Flutter e Dart', 'Aplicativo Android.'],
    ],
    'Segurança e padrões' => [
        ['bcrypt e JWT', 'Senhas criptografadas e sessão por token Bearer.'],
        ['Multitenant, RBAC, LGPD e WCAG', 'Isolamento, permissões, proteção de dados e contraste.'],
    ],
];

$paleta = [
    ['nome' => 'Fundo principal', 'hex' => '#0B1120', 'uso' => 'Menos brilho em uso prolongado, sem o desconforto do preto puro.'],
    ['nome' => 'Painéis e cards', 'hex' => '#1E293B', 'uso' => 'Separa cartões, menus e tabelas mantendo a leitura.'],
    ['nome' => 'Azul Astah', 'hex' => '#2563EB', 'uso' => 'Botões principais e itens ativos. Confiança e organização.'],
    ['nome' => 'Ciano espacial', 'hex' => '#06B6D4', 'uso' => 'Prateleira selecionada no mapa e indicadores técnicos.'],
    ['nome' => 'Verde', 'hex' => '#10B981', 'uso' => 'Estoque em dia, máquina rodando, sincronização concluída.'],
    ['nome' => 'Âmbar', 'hex' => '#F59E0B', 'uso' => 'Perto do mínimo ou preventiva chegando.'],
    ['nome' => 'Vermelho', 'hex' => '#EF4444', 'uso' => 'Item zerado, falha grave ou máquina parada.'],
    ['nome' => 'Texto', 'hex' => '#F8FAFC', 'uso' => 'Leitura clara acima do contraste exigido pela WCAG 2.1 AA.'],
];

$equipe = [
    ['nome' => 'Ciro Eduardo Arruda Costa', 'papel' => 'Desenvolvimento e gestão do projeto'],
    ['nome' => 'Gustavo Breder Leal', 'papel' => 'Desenvolvimento e gestão do projeto'],
];

$banca = [
    ['nome' => 'Priscila Keli Lima Pinto Frizzarin', 'papel' => 'Orientadora'],
    ['nome' => 'Simone Berbert R. Dapolito', 'papel' => 'Banca'],
    ['nome' => 'Tânia Basso', 'papel' => 'Banca'],
];

function iniciais($nome)
{
    $partes = explode(' ', $nome);
    return mb_substr($partes[0], 0, 1) . mb_substr(end($partes), 0, 1);
}
