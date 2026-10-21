<?php
$pagina = 'documentacao';
$titulo = 'Documentação · ASTHA RAVEN';
$descricao = 'Requisitos, modelagem, casos de uso, cronograma e tecnologias do TCC Raven Astah.';
include "includes/navbar.php";

$capitulos = [
    'resumo' => 'Resumo',
    'requisitos' => 'Requisitos funcionais',
    'nao-funcionais' => 'Não funcionais',
    'termo' => 'Termo de abertura',
    'negocio' => 'Modelo de negócios',
    'mer' => 'Banco de dados (MER)',
    'casos' => 'Casos de uso',
    'cronograma' => 'Planejamento',
    'tecnologias' => 'Tecnologias',
    'cores' => 'Paleta de cores',
    'referencias' => 'Referências',
];

$referencias = [
    'AGATETEPE, B.; KACHAN, O. Ergonomia visual e esquemas cromáticos em interfaces de monitoramento contínuo. Revista de Design e Interação Humano-Computador, São Paulo, v. 14, n. 1, p. 45-62, 2026.',
    'ÁGUIA SISTEMAS. Intralogística e eficiência na separação de pedidos (picking) em armazéns brasileiros. Ponta Grossa: Águia Sistemas, 2023.',
    'BRASIL. Lei nº 13.709, de 14 de agosto de 2018. Lei Geral de Proteção de Dados Pessoais (LGPD). Brasília, DF: Presidência da República, 2018.',
    'CNI – CONFEDERAÇÃO NACIONAL DA INDÚSTRIA. Sondagem Especial 84: Indústria 4.0 – Cinco anos depois. Brasília, DF: CNI, 2022.',
    'EBAC – ESCOLA BRITÂNICA DE ARTES CRIATIVAS E TECNOLOGIA. Psicologia das cores no UI Design. São Paulo: EBAC, 2023.',
    'ECMA INTERNATIONAL. ECMAScript® 2023 Language Specification. 14th ed. Geneva: Ecma International, 2023.',
    'GOOGLE. Dart Language Guide. Mountain View: Google, 2024a.',
    'GOOGLE. Flutter Documentation. Mountain View: Google, 2024b.',
    'ILOS – INSTITUTO DE LOGÍSTICA E SUPPLY CHAIN. Panorama Custos Logísticos no Brasil. Rio de Janeiro: ILOS, 2026.',
    'JONES, Michael B.; BRADLEY, John; SAKIMURA, Nat. JSON Web Token (JWT). RFC 7519. IETF, 2015.',
    'LIMA, Maurício Pereira; LOBO, Alexandre. Custos logísticos no Brasil: evolução dos gastos com transporte, armazenagem e estoque. Tecnologística, São Paulo, v. 29, n. 315, p. 28-35, 2024.',
    'OPENJS FOUNDATION. Node.js Documentation. San Francisco: OpenJS Foundation, 2024a.',
    'OPENJS FOUNDATION. Electron Documentation. San Francisco: OpenJS Foundation, 2024b.',
    'ORACLE CORPORATION. MySQL 8.0 Reference Manual. Austin: Oracle, 2024.',
    'SEBRAE. Maturidade digital e gestão de estoques nas micro e pequenas empresas brasileiras. Brasília, DF: Sebrae, 2025.',
    'THREE.JS. Three.js Documentation: JavaScript 3D Library. Three.js Project, 2024.',
    'W3C – WORLD WIDE WEB CONSORTIUM. Web Content Accessibility Guidelines (WCAG) 2.1. Cambridge: W3C, 2023.',
    'WHATWG. HTML Living Standard. WHATWG, 2024.',
    'ZEBRA TECHNOLOGIES; OXFORD ECONOMICS. Global Warehousing and Inventory Visibility Study. Lincolnshire: Zebra Technologies Corp., 2026.',
];

// cor do texto em cima de cada amostra da paleta
function corDoTexto($hex)
{
    [$r, $g, $b] = sscanf($hex, '#%02x%02x%02x');
    return ($r * 299 + $g * 587 + $b * 114) / 1000 > 150 ? '#0b1120' : '#ffffff';
}
?>

    <header class="rv-topo-pagina">
        <div class="rv-hero-fundo" aria-hidden="true"></div>
        <div class="container-lg position-relative">
            <span class="rv-selo revelar"><span class="ponto"></span>Trabalho de Conclusão de Curso · 63 páginas</span>
            <h1 class="mt-3 revelar">Documentação do projeto</h1>
            <p class="lead rv-texto-suave col-lg-8 revelar">Raven Astah: sistema multiplataforma para gestão de estoques, ativos
            industriais e mapeamento espacial 2D/3D. Técnico em Desenvolvimento de Sistemas, COTIL / Unicamp, Limeira, 2026.</p>
            <div class="d-flex flex-wrap gap-3 mt-4 revelar">
                <a href="assets/doc/Documentacao_TCC_Raven_Astah_2026.pdf" class="btn btn-primary btn-lg" target="_blank"><i class="bi bi-file-earmark-pdf me-2"></i>Abrir o PDF completo</a>
                <a href="assets/doc/Documentacao_TCC_Raven_Astah_2026.pdf" class="btn btn-outline-light btn-lg" download><i class="bi bi-download me-2"></i>Baixar</a>
            </div>
        </div>
    </header>

    <div class="rv-secao rv-doc">
        <div class="container-lg">
            <div class="row g-5">
                <aside class="col-12 col-lg-3">
                    <nav class="rv-doc-menu">
                        <?php foreach ($capitulos as $id => $nome): ?>
                        <a href="#<?= $id ?>"><?= $nome ?></a>
                        <?php endforeach; ?>
                    </nav>
                </aside>

                <div class="col-12 col-lg-9">

                    <section id="resumo">
                        <h2><small>01</small>Resumo</h2>
                        <p class="lead">O Raven Astah é um sistema multiplataforma (Web, Desktop com Electron e Mobile com Flutter)
                        para controle de estoque e almoxarifado (WMS), gestão de manutenção de máquinas (EAM), análise de
                        confiabilidade e mapeamento de ambientes em 2D e 3D.</p>
                        <p>O projeto surgiu de problemas comuns na rotina das empresas: erro de contagem em planilha, falta de peça
                        de reposição na hora da manutenção e tempo perdido procurando onde cada material foi guardado. Além do uso
                        empresarial, o sistema tem um Modo Pessoal para quem quer organizar objetos e documentos em casa.</p>
                        <p>Foi construída uma API RESTful em Node.js com MySQL 8.0, uma interface Web/Desktop com 3D em Three.js
                        empacotada pelo Electron e um aplicativo Flutter com SQLite para funcionar sem internet. O sistema foi
                        validado no navegador, no Windows, no Linux e no Android. Faltam apenas os testes em macOS e iOS.</p>
                        <div class="row g-3 mt-2">
                            <?php foreach ([[count($modulos), 'módulos'], [count($casosDeUso), 'casos de uso'], ['3', 'plataformas testadas'], [count($referencias), 'referências']] as [$n, $t]): ?>
                            <div class="col-6 col-md-3">
                                <div class="rv-mini text-center py-3"><strong class="fs-3"><?= $n ?></strong><small><?= $t ?></small></div>
                            </div>
                            <?php endforeach; ?>
                        </div>
                        <p class="small text-muted mt-3 mb-0"><strong>Palavras-chave:</strong> gestão de estoque; manutenção de ativos;
                        mapeamento 3D; Electron; Flutter.</p>
                    </section>

                    <section id="requisitos">
                        <h2><small>02</small>Requisitos funcionais</h2>
                        <p class="text-muted">O que o sistema faz, separado pelos quatro módulos.</p>
                        <div class="accordion" id="listaRequisitos">
                            <?php $n = 0; foreach ($requisitosFuncionais as $grupo => $requisitos): $n++; ?>
                            <div class="accordion-item">
                                <h3 class="accordion-header">
                                    <button class="accordion-button<?= $n > 1 ? ' collapsed' : '' ?>" type="button" data-bs-toggle="collapse" data-bs-target="#rf<?= $n ?>">
                                        <?= $grupo ?>
                                        <span class="badge rounded-pill text-bg-light ms-2"><?= count($requisitos) ?></span>
                                    </button>
                                </h3>
                                <div id="rf<?= $n ?>" class="accordion-collapse collapse<?= $n === 1 ? ' show' : '' ?>" data-bs-parent="#listaRequisitos">
                                    <div class="accordion-body">
                                        <?php foreach ($requisitos as $nome => $texto): ?>
                                        <div class="mb-3">
                                            <h6 class="fw-bold mb-1"><?= $nome ?></h6>
                                            <p class="text-muted mb-0"><?= $texto ?></p>
                                        </div>
                                        <?php endforeach; ?>
                                    </div>
                                </div>
                            </div>
                            <?php endforeach; ?>
                        </div>
                    </section>

                    <section id="nao-funcionais">
                        <h2><small>03</small>Requisitos não funcionais</h2>
                        <div class="row g-3">
                            <?php foreach ($requisitosNaoFuncionais as $rnf): ?>
                            <div class="col-12 col-md-6 revelar">
                                <div class="rv-rnf">
                                    <i class="bi <?= $rnf['icone'] ?>"></i>
                                    <h6><?= $rnf['titulo'] ?></h6>
                                    <p><?= $rnf['texto'] ?></p>
                                </div>
                            </div>
                            <?php endforeach; ?>
                        </div>
                    </section>

                    <section id="termo">
                        <h2><small>04</small>Termo de abertura</h2>
                        <div class="table-responsive">
                            <table class="table rv-termo align-top">
                                <tr><th>Projeto</th><td>Raven Astah</td></tr>
                                <tr><th>Justificativa</th><td>Custos logísticos chegam a 15,5% do PIB (R$ 1,82 trilhão), sendo R$ 584 bilhões só
                                com armazenagem e estoques. Erros de inventário custam em média 5,8% da receita e mais de 50% do tempo de
                                separação é gasto procurando material nos corredores.</td></tr>
                                <tr><th>Produto</th><td>Aplicação Web, Desktop (Electron) e Mobile (Flutter) com WMS, EAM, Estúdio de Análises,
                                mapa 2D/3D e Modo Pessoal.</td></tr>
                                <tr><th>Gerentes</th><td><?= implode(' e ', array_column($equipe, 'nome')) ?>. Autoridade alta.</td></tr>
                                <tr><th>Patrocinador</th><td>Unicamp – Colégio Técnico de Limeira (COTIL)</td></tr>
                                <tr><th>Partes interessadas</th><td>Operadores de almoxarifado, gestores logísticos, técnicos e engenheiros de
                                manutenção, PMEs, usuários domésticos, orientadores e banca.</td></tr>
                                <tr><th>Restrições</th><td>Entrega até outubro de 2026, sem orçamento: só ferramentas gratuitas ou de código
                                aberto. Testes em Windows, Linux e Android; macOS e iOS sem hardware para testar.</td></tr>
                                <tr><th>Tecnologias</th><td>JavaScript (ES2023), HTML5, CSS3, SQL e Dart. Node.js, Electron, Three.js e Flutter.
                                MySQL 8.0 e SQLite.</td></tr>
                                <tr><th>Autorização</th><td>24 de fevereiro de 2026</td></tr>
                            </table>
                        </div>
                    </section>

                    <section id="negocio">
                        <h2><small>05</small>Modelo de negócios</h2>
                        <p class="text-muted">Canvas do Raven Astah: proposta de valor, clientes, canais e fontes de receita.</p>
                        <figure class="rv-figura revelar">
                            <img src="assets/doc/canvas.jpg" alt="Canvas do modelo de negócios" data-ampliar="assets/doc/canvas.jpg" data-titulo="Figura 1 – Canvas do modelo de negócios" loading="lazy">
                            <figcaption>Figura 1 – Canvas do modelo de negócios. Fonte: elaboração própria.</figcaption>
                        </figure>
                    </section>

                    <section id="mer">
                        <h2><small>06</small>Banco de dados (MER)</h2>
                        <p class="text-muted">MySQL 8.0. Toda tabela de negócio carrega a organização dona do registro, e as
                        movimentações apontam para o material e para quem fez a operação.</p>
                        <figure class="rv-figura revelar">
                            <img src="assets/doc/mer.jpg" alt="Modelo entidade-relacionamento" data-ampliar="assets/doc/mer.jpg" data-titulo="Figura 2 – Modelo Entidade-Relacionamento" loading="lazy">
                            <figcaption>Figura 2 – Modelo Entidade-Relacionamento. Fonte: elaboração própria.</figcaption>
                        </figure>
                    </section>

                    <section id="casos">
                        <h2><small>07</small>Casos de uso</h2>
                        <div class="row g-3 mb-4">
                            <div class="col-12 col-md-6">
                                <figure class="rv-figura revelar">
                                    <img src="assets/doc/caso-de-uso-1.jpg" alt="Diagrama de caso de uso da operação" data-ampliar="assets/doc/caso-de-uso-1.jpg" data-titulo="Figura 3 – Operação WMS, EAM e Modo Pessoal" loading="lazy">
                                    <figcaption>Figura 3 – Operação WMS, EAM e Modo Pessoal</figcaption>
                                </figure>
                            </div>
                            <div class="col-12 col-md-6">
                                <figure class="rv-figura revelar">
                                    <img src="assets/doc/caso-de-uso-2.jpg" alt="Diagrama de caso de uso da gestão" data-ampliar="assets/doc/caso-de-uso-2.jpg" data-titulo="Figura 4 – Gestão corporativa e análises" loading="lazy">
                                    <figcaption>Figura 4 – Gestão corporativa e análises</figcaption>
                                </figure>
                            </div>
                        </div>
                        <div class="row">
                            <?php foreach (array_chunk($casosDeUso, 8, true) as $coluna): ?>
                            <div class="col-12 col-md-6">
                                <?php foreach ($coluna as $codigo => $nome): ?>
                                <div class="rv-uc"><code><?= $codigo ?></code><span><?= $nome ?></span></div>
                                <?php endforeach; ?>
                            </div>
                            <?php endforeach; ?>
                        </div>
                        <p class="small text-muted mt-3">Cada caso de uso traz ator, pré e pós-condições, fluxo principal e fluxos
                        alternativos no documento completo.</p>
                    </section>

                    <section id="cronograma">
                        <h2><small>08</small>Planejamento</h2>
                        <p class="text-muted">Do termo de abertura (fevereiro) até a entrega (outubro de 2026), em cinco fases.</p>
                        <div class="rv-cronograma">
                            <?php foreach ($cronograma as $i => $fase): ?>
                            <div class="rv-fase revelar" data-n="<?= $i + 1 ?>">
                                <h6><?= $fase['fase'] ?></h6>
                                <ul>
                                    <?php foreach ($fase['itens'] as $item): ?>
                                    <li><?= $item ?></li>
                                    <?php endforeach; ?>
                                </ul>
                            </div>
                            <?php endforeach; ?>
                        </div>
                    </section>

                    <section id="tecnologias">
                        <h2><small>09</small>Tecnologias</h2>
                        <div class="table-responsive">
                            <table class="table align-middle">
                                <thead><tr><th>Camada</th><th>Tecnologia</th><th>Uso no projeto</th></tr></thead>
                                <tbody>
                                <?php foreach ($tecnologias as $camada => $linhas): ?>
                                    <?php foreach ($linhas as $i => [$tecnologia, $uso]): ?>
                                    <tr>
                                        <?php if ($i === 0): ?><th rowspan="<?= count($linhas) ?>" class="text-primary"><?= $camada ?></th><?php endif; ?>
                                        <td class="fw-bold"><?= $tecnologia ?></td>
                                        <td class="text-muted"><?= $uso ?></td>
                                    </tr>
                                    <?php endforeach; ?>
                                <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section id="cores">
                        <h2><small>10</small>Paleta de cores</h2>
                        <p class="text-muted">Pensada para quem passa o turno inteiro olhando tabela: azul-ardósia em vez de preto
                        puro, e cor forte só para aviso. Contraste mínimo de 4,5:1 (WCAG 2.1 AA).</p>
                        <div class="row g-3">
                            <?php foreach ($paleta as $cor): ?>
                            <div class="col-6 col-md-3 revelar">
                                <div class="rv-amostra">
                                    <div class="cor" style="background: <?= $cor['hex'] ?>; color: <?= corDoTexto($cor['hex']) ?>"><?= $cor['hex'] ?></div>
                                    <div>
                                        <strong><?= $cor['nome'] ?></strong>
                                        <p><?= $cor['uso'] ?></p>
                                    </div>
                                </div>
                            </div>
                            <?php endforeach; ?>
                        </div>
                    </section>

                    <section id="referencias">
                        <h2><small>11</small>Referências</h2>
                        <ol class="rv-referencias">
                            <?php foreach ($referencias as $ref): ?>
                            <li><?= $ref ?></li>
                            <?php endforeach; ?>
                        </ol>
                    </section>

                </div>
            </div>
        </div>
    </div>

    <div class="rv-lightbox" role="dialog" aria-modal="true" aria-label="Figura ampliada">
        <button type="button" class="fechar" aria-label="Fechar"><i class="bi bi-x-lg"></i></button>
        <button type="button" class="seta anterior" aria-label="Anterior"><i class="bi bi-chevron-left"></i></button>
        <figure>
            <img src="" alt="">
            <figcaption></figcaption>
        </figure>
        <button type="button" class="seta proxima" aria-label="Próxima"><i class="bi bi-chevron-right"></i></button>
    </div>

<?php include "includes/rodape.php"; ?>
