<?php
$pagina = 'inicio';
$titulo = 'ASTHA RAVEN — estoque, manutenção e mapa 3D';
include "includes/navbar.php";

// Pareto: acumulado de cada causa
$totalHoras = array_sum(array_column($pareto, 'horas'));
$acumulado = 0;
foreach ($pareto as &$causa) {
    $acumulado += $causa['horas'];
    $causa['acumulado'] = $acumulado / $totalHoras * 100;
}
unset($causa);

// Weibull: R(t) = e^-(t/η)^β, de 0 a 4000 h
$curvaWeibull = [];
for ($t = 0; $t <= 4000; $t += 50) {
    $curvaWeibull[] = [$t, exp(-pow($t / $weibull['eta'], $weibull['beta']))];
}
$b10 = $weibull['eta'] * pow(-log(0.9), 1 / $weibull['beta']);

function pontosCurva($curva, $largura, $altura)
{
    $ultimo = end($curva)[0];
    return implode(' ', array_map(fn($p) => round($p[0] / $ultimo * $largura, 1) . ',' . round((1 - $p[1]) * $altura, 1), $curva));
}

function numeroBR($n, $casas = 0)
{
    return number_format($n, $casas, ',', '.');
}
?>

   <header class="rv-hero" id="intro">
        <div class="rv-hero-fundo" aria-hidden="true"></div>
        <div class="container-lg position-relative">
            <div class="row align-items-center g-5">
                <div class="col-12 col-lg-6 text-light">
                    <span class="rv-selo revelar"><span class="ponto"></span>TCC · COTIL / Unicamp · 2026</span>
                    <h1 class="rv-titulo-hero revelar">Cada peça no lugar certo. <span class="rv-destaque">E você sabe qual é.</span></h1>
                    <p class="lead rv-texto-suave revelar">O ASTHA RAVEN junta controle de estoque, manutenção de máquinas e um mapa
                    2D/3D do galpão em um sistema só. Roda no navegador, no computador com Electron e no celular com Flutter,
                    inclusive sem internet.</p>
                    <div class="d-flex flex-wrap gap-3 mt-4 revelar">
                        <a class="btn btn-lg btn-primary px-4" href="<?= $repositorio ?>" target="_blank" rel="noopener"><i class="bi bi-download me-2"></i>Baixar ASTHA RAVEN</a>
                        <a class="btn btn-lg btn-outline-light px-4" href="telas.php">Ver as telas</a>
                    </div>
                    <ul class="rv-plataformas revelar">
                        <li><i class="bi bi-globe2"></i>Web</li>
                        <li><i class="bi bi-windows"></i>Windows</li>
                        <li><i class="bi bi-ubuntu"></i>Linux</li>
                        <li><i class="bi bi-android2"></i>Android</li>
                    </ul>
                </div>

                <div class="col-12 col-lg-6">
                    <div class="rv-palco" data-paralaxe>
                        <div class="browser-frame rv-tela-hero">
                            <div class="browser-frame-bar">
                                <span></span><span></span><span></span>
                                <div class="rv-endereco">localhost:3000/app/home.html</div>
                            </div>
                            <div class="rv-ciclo" data-ciclo="4200">
                                <img src="assets/telas/web/launchpad.jpg" class="ativa" alt="Launchpad do ASTHA RAVEN">
                                <img src="assets/telas/web/wms-dashboard.jpg" alt="Dashboard do WMS" loading="lazy">
                                <img src="assets/telas/web/mapa-3d.jpg" alt="Central de mapas em 3D" loading="lazy">
                                <img src="assets/telas/web/pareto.jpg" alt="Pareto no Estúdio de Análises" loading="lazy">
                            </div>
                        </div>

                        <div class="rv-celular rv-celular-hero">
                            <div class="rv-celular-tela rv-ciclo" data-ciclo="3600">
                                <img src="assets/telas/mobile/launchpad.jpg" class="ativa" alt="Launchpad no celular">
                                <img src="assets/telas/mobile/estoque.jpg" alt="Estoque no celular" loading="lazy">
                                <img src="assets/telas/mobile/mapa-3d.jpg" alt="Mapa 3D no celular" loading="lazy">
                            </div>
                        </div>

                        <div class="rv-flutuante rv-flutuante-1">
                            <span class="rv-rotulo">Disponibilidade</span>
                            <strong><span data-contar="<?= $bomba['disponibilidade'] ?>" data-casas="2">0</span>%</strong>
                            <small>LAB-BOMBA-P1</small>
                        </div>
                        <div class="rv-flutuante rv-flutuante-2">
                            <i class="bi bi-exclamation-triangle-fill text-warning"></i>
                            <div>
                                <span class="rv-rotulo">Abaixo do mínimo</span>
                                <strong>Selo mecânico · 1 un</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </header>

    <div class="rv-faixa-tecnologias" aria-label="Tecnologias usadas">
        <div class="rv-faixa-trilho">
            <?php for ($volta = 0; $volta < 2; $volta++): ?>
            <span>Node.js</span><span>MySQL 8.0</span><span>Three.js</span><span>Electron</span><span>Flutter</span>
            <span>SQLite</span><span>JWT</span><span>bcrypt</span><span>WebGL</span><span>Canvas 2D</span><span>RBAC</span><span>LGPD</span>
            <?php endfor; ?>
        </div>
    </div>

   <section id="sobre" class="rv-secao">
        <div class="container-lg">
            <div class="row g-5 align-items-end mb-5">
                <div class="col-12 col-lg-6 revelar">
                    <span class="rv-rotulo text-primary">Por que existe</span>
                    <h2 class="display-5 mt-2">Planilha não mostra onde a peça está.</h2>
                </div>
                <div class="col-12 col-lg-6 revelar">
                    <p class="lead text-muted mb-0">Muita empresa ainda controla o almoxarifado em planilhas soltas. Ninguém sabe
                    quem tirou o quê, o estoque mínimo não avisa ninguém e o técnico perde tempo andando entre corredores
                    atrás de um rolamento. Os números abaixo foram o ponto de partida do projeto.</p>
                </div>
            </div>

            <div class="row g-4">
                <?php foreach ($numeros as $i => $n): ?>
                <div class="col-12 col-sm-6 col-lg-3 revelar" style="--atraso: <?= $i * 90 ?>ms">
                    <div class="rv-numero">
                        <div class="rv-numero-valor">
                            <?= $n['prefixo'] ?? '' ?><span data-contar="<?= $n['valor'] ?>" data-casas="<?= $n['casas'] ?>">0</span><?= $n['sufixo'] ?>
                        </div>
                        <p><?= $n['texto'] ?></p>
                        <small><?= $n['fonte'] ?></small>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
   </section>

   <section id="modulos" class="rv-secao rv-secao-cinza">
        <div class="container-lg">
            <div class="text-center mb-5 revelar">
                <span class="rv-rotulo text-primary">Quatro módulos, um login</span>
                <h2 class="display-5 mt-2">Do almoxarifado à sala de casa</h2>
            </div>

            <div class="row g-4 align-items-center" id="features">
                <div class="col-12 col-lg-5">
                    <div class="rv-modulos" role="tablist">
                        <?php $primeiro = true; foreach ($modulos as $chave => $m): ?>
                        <button class="rv-modulo<?= $primeiro ? ' ativo' : '' ?>" type="button" role="tab"
                            data-modulo="<?= $chave ?>" style="--cor: <?= $m['cor'] ?>">
                            <span class="rv-modulo-icone"><i class="bi <?= $m['icone'] ?>"></i></span>
                            <span class="flex-grow-1">
                                <strong><?= $m['nome'] ?></strong>
                                <span class="rv-modulo-resumo"><?= $m['resumo'] ?></span>
                                <ul>
                                    <?php foreach ($m['itens'] as $item): ?>
                                    <li><?= $item ?></li>
                                    <?php endforeach; ?>
                                </ul>
                            </span>
                            <span class="rv-modulo-barra"></span>
                        </button>
                        <?php $primeiro = false; endforeach; ?>
                    </div>
                </div>
                <div class="col-12 col-lg-7 revelar">
                    <div class="browser-frame rv-tela-modulo">
                        <div class="browser-frame-bar"><span></span><span></span><span></span></div>
                        <div class="rv-ciclo" id="telaModulo">
                            <?php $primeiro = true; foreach ($modulos as $chave => $m): ?>
                            <img src="assets/telas/web/<?= $m['tela'] ?>.jpg" data-modulo="<?= $chave ?>" class="<?= $primeiro ? 'ativa' : '' ?>" alt="Tela do módulo <?= $m['nome'] ?>" loading="lazy">
                            <?php $primeiro = false; endforeach; ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>
   </section>

   <section id="mapa" class="rv-secao rv-secao-escura">
        <div class="container-lg">
            <div class="row g-5 align-items-center">
                <div class="col-12 col-lg-5 text-light">
                    <span class="rv-rotulo rv-ciano">Mapa 2D/3D</span>
                    <h2 class="display-5 mt-2 revelar">Pesquisa o material, o galpão acende a prateleira.</h2>
                    <p class="lead rv-texto-suave revelar">O editor CAD desenha a planta em 2D e o visualizador monta o mesmo
                    galpão em 3D com Three.js. Cada material tem um endereço no formato prateleira, nível e posição.</p>

                    <div class="rv-busca revelar" aria-live="polite">
                        <div class="rv-busca-campo">
                            <i class="bi bi-search"></i>
                            <span id="buscaTexto"></span><span class="cursor"></span>
                        </div>
                        <div class="rv-busca-resultado" id="buscaResultado">
                            <div>
                                <small id="buscaCodigo">LAB-MAT-1</small>
                                <strong id="buscaMaterial">Rolamento</strong>
                            </div>
                            <div class="text-end">
                                <span class="rv-endereco-material" id="buscaLocal">A1-N1-P1</span>
                                <small id="buscaSaldo">saldo 24</small>
                            </div>
                        </div>
                    </div>
                    <p class="small rv-texto-suave mt-3 mb-0">Posições reais dos 5 materiais do laboratório de testes.</p>
                </div>
                <div class="col-12 col-lg-7">
                    <div class="rv-armazem-moldura revelar" data-locais='<?= json_encode($localizacoes, JSON_UNESCAPED_UNICODE) ?>'>
                        <?php include "includes/armazem.php"; ?>
                        <div class="rv-legenda">
                            <span><i class="status-ok"></i>Em estoque</span>
                            <span><i class="status-minimo"></i>Abaixo do mínimo</span>
                            <span><i class="status-zerado"></i>Zerado</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
   </section>

   <section id="analises" class="rv-secao">
        <div class="container-lg">
            <div class="row g-5 align-items-end mb-5">
                <div class="col-12 col-lg-6 revelar">
                    <span class="rv-rotulo text-primary">Manutenção e Estúdio de Análises</span>
                    <h2 class="display-5 mt-2">A máquina parou três vezes. Por quê, e quando vai parar de novo?</h2>
                </div>
                <div class="col-12 col-lg-6 revelar">
                    <p class="lead text-muted mb-0">Com as ordens de serviço registradas, o sistema calcula sozinho MTBF, MTTR e
                    disponibilidade. No Estúdio dá pra ir além: Pareto das causas, Kaplan-Meier e ajuste de Weibull. Os
                    números abaixo são do equipamento de teste, de 03/09 a 03/10/2026.</p>
                </div>
            </div>

            <div class="row g-4">
                <div class="col-12 col-lg-4 revelar">
                    <div class="rv-painel h-100">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <div>
                                <span class="rv-rotulo">Equipamento</span>
                                <h5 class="mb-0">LAB-BOMBA-P1</h5>
                                <small class="text-muted">Bomba centrífuga · criticidade crítica</small>
                            </div>
                            <span class="badge rounded-pill text-bg-success">Ativo</span>
                        </div>
                        <div class="rv-anel" style="--valor: <?= $bomba['disponibilidade'] ?>">
                            <svg viewBox="0 0 120 120" aria-hidden="true">
                                <circle cx="60" cy="60" r="52" class="trilho"/>
                                <circle cx="60" cy="60" r="52" class="progresso" pathLength="100"/>
                            </svg>
                            <div class="rv-anel-texto">
                                <strong><span data-contar="<?= $bomba['disponibilidade'] ?>" data-casas="2">0</span>%</strong>
                                <small>disponibilidade</small>
                            </div>
                        </div>
                        <div class="row g-2 text-center mt-3">
                            <div class="col-4"><div class="rv-mini"><strong><span data-contar="<?= $bomba['mtbf'] ?>">0</span> h</strong><small>MTBF</small></div></div>
                            <div class="col-4"><div class="rv-mini"><strong><span data-contar="<?= $bomba['mttr'] ?>" data-casas="1">0</span> h</strong><small>MTTR</small></div></div>
                            <div class="col-4"><div class="rv-mini"><strong><span data-contar="<?= $bomba['falhas'] ?>">0</span></strong><small>falhas</small></div></div>
                        </div>
                        <div class="rv-linha-tempo-maquina mt-4">
                            <div style="flex: <?= $bomba['operacao'] ?>" class="operando"></div>
                            <div style="flex: <?= $bomba['parada'] * 6 ?>" class="parado"></div>
                        </div>
                        <div class="d-flex justify-content-between small text-muted mt-2">
                            <span><?= $bomba['operacao'] ?> h operando</span>
                            <span><?= $bomba['parada'] ?> h parada</span>
                        </div>
                    </div>
                </div>

                <div class="col-12 col-lg-4 revelar" style="--atraso: 100ms">
                    <div class="rv-painel h-100">
                        <span class="rv-rotulo">Pareto · horas perdidas</span>
                        <h5>80% do problema em 3 causas</h5>
                        <svg viewBox="0 0 300 200" class="rv-pareto" role="img" aria-label="Gráfico de Pareto das horas perdidas">
                            <?php foreach ([0, 25, 50, 75, 100] as $g): ?>
                            <line x1="0" x2="300" y1="<?= 170 - $g * 1.6 ?>" y2="<?= 170 - $g * 1.6 ?>" class="grade"/>
                            <?php endforeach; ?>
                            <?php foreach ($pareto as $i => $c):
                                $altura = $c['horas'] / $pareto[0]['horas'] * 150;
                                $x = 10 + $i * 48; ?>
                            <rect x="<?= $x ?>" y="<?= 170 - $altura ?>" width="34" height="<?= $altura ?>" rx="4" class="barra" style="--i: <?= $i ?>">
                                <title><?= $c['causa'] ?>: <?= $c['horas'] ?> h</title>
                            </rect>
                            <text x="<?= $x + 17 ?>" y="<?= 164 - $altura ?>" class="valor"><?= $c['horas'] ?></text>
                            <text x="<?= $x + 17 ?>" y="186" class="causa"><?= mb_substr($c['causa'], 0, 6) ?>.</text>
                            <?php endforeach; ?>
                            <polyline class="acumulado" pathLength="100" points="<?= implode(' ', array_map(fn($i) => (27 + $i * 48) . ',' . round(170 - $pareto[$i]['acumulado'] * 1.6, 1), array_keys($pareto))) ?>"/>
                            <?php foreach ($pareto as $i => $c): ?>
                            <circle cx="<?= 27 + $i * 48 ?>" cy="<?= round(170 - $c['acumulado'] * 1.6, 1) ?>" r="3.5" class="ponto"/>
                            <?php endforeach; ?>
                        </svg>
                        <p class="small text-muted mb-0">Total de <?= $totalHoras ?> h. Rolamento, selo e desalinhamento somam <?= numeroBR($pareto[2]['acumulado'], 1) ?>%.</p>
                    </div>
                </div>

                <div class="col-12 col-lg-4 revelar" style="--atraso: 200ms">
                    <div class="rv-painel h-100">
                        <span class="rv-rotulo">Weibull 2P · vida de rolamentos</span>
                        <h5>β <?= numeroBR($weibull['beta'], 2) ?> · η <?= numeroBR($weibull['eta'], 0) ?> h</h5>
                        <svg viewBox="0 0 300 200" class="rv-weibull" role="img" aria-label="Curva de confiabilidade Weibull">
                            <?php foreach ([0, 0.25, 0.5, 0.75, 1] as $g): ?>
                            <line x1="0" x2="300" y1="<?= 10 + $g * 160 ?>" y2="<?= 10 + $g * 160 ?>" class="grade"/>
                            <?php endforeach; ?>
                            <g transform="translate(0 10)">
                                <polygon class="area" points="0,160 <?= pontosCurva($curvaWeibull, 300, 160) ?> 300,160"/>
                                <polyline class="curva" pathLength="100" points="<?= pontosCurva($curvaWeibull, 300, 160) ?>"/>
                                <?php $xb = round($b10 / 4000 * 300, 1); ?>
                                <line x1="<?= $xb ?>" x2="<?= $xb ?>" y1="0" y2="160" class="marco"/>
                                <circle cx="<?= $xb ?>" cy="<?= 0.1 * 160 ?>" r="4" class="ponto"/>
                                <text x="<?= $xb + 10 ?>" y="12" class="rotulo-b10">B10 = <?= numeroBR($b10, 0) ?> h</text>
                            </g>
                            <text x="0" y="198" class="eixo">0 h</text>
                            <text x="300" y="198" class="eixo" text-anchor="end">4.000 h</text>
                        </svg>
                        <p class="small text-muted mb-0">Probabilidade de o rolamento ainda estar funcionando ao longo das horas.
                        10% falham até as <?= numeroBR($b10, 0) ?> h.</p>
                    </div>
                </div>
            </div>
        </div>
   </section>

   <section id="plataformas" class="rv-secao rv-secao-cinza">
        <div class="container-lg">
            <div class="text-center mb-5 revelar">
                <span class="rv-rotulo text-primary">Arquitetura</span>
                <h2 class="display-5 mt-2">Uma API, três jeitos de usar</h2>
                <p class="lead text-muted col-lg-8 mx-auto">A mesma API em Node.js atende o navegador, o programa de computador e o
                aplicativo. No celular, o SQLite guarda tudo enquanto o galpão está sem sinal.</p>
            </div>

            <div class="rv-arquitetura revelar">
                <div class="rv-no rv-no-cliente">
                    <i class="bi bi-browser-chrome"></i>
                    <strong>Web</strong>
                    <small>HTML5 · CSS3 · JS · Three.js</small>
                </div>
                <div class="rv-no rv-no-cliente">
                    <i class="bi bi-pc-display"></i>
                    <strong>Desktop</strong>
                    <small>Electron · Windows e Linux</small>
                </div>
                <div class="rv-no rv-no-cliente">
                    <i class="bi bi-phone"></i>
                    <strong>Mobile</strong>
                    <small>Flutter · SQLite offline</small>
                </div>

                <svg class="rv-fios" viewBox="0 0 900 120" preserveAspectRatio="none" aria-hidden="true">
                    <path id="fio1" d="M150 0 C150 60, 450 60, 450 120"/>
                    <path id="fio2" d="M450 0 L450 120"/>
                    <path id="fio3" d="M750 0 C750 60, 450 60, 450 120"/>
                    <circle r="5" class="pacote"><animateMotion dur="2.4s" repeatCount="indefinite"><mpath href="#fio1"/></animateMotion></circle>
                    <circle r="5" class="pacote"><animateMotion dur="1.8s" begin=".6s" repeatCount="indefinite"><mpath href="#fio2"/></animateMotion></circle>
                    <circle r="5" class="pacote volta"><animateMotion dur="2.8s" begin="1s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear"><mpath href="#fio3"/></animateMotion></circle>
                </svg>

                <div class="rv-no rv-no-api">
                    <i class="bi bi-hdd-network"></i>
                    <div>
                        <strong>API RESTful · Node.js</strong>
                        <small>JWT · bcrypt · RBAC · workspace_id em toda consulta</small>
                    </div>
                </div>
                <div class="rv-conector" aria-hidden="true"></div>
                <div class="rv-no rv-no-banco">
                    <i class="bi bi-database"></i>
                    <div>
                        <strong>MySQL 8.0</strong>
                        <small>Transações ACID · entrada e saída nunca gravam pela metade</small>
                    </div>
                </div>
            </div>
        </div>
   </section>

   <section id="mobile" class="rv-secao rv-secao-escura rv-secao-mobile">
        <div class="container-lg">
            <div class="row g-5 align-items-center">
                <div class="col-12 col-lg-5 text-light order-lg-2">
                    <span class="rv-rotulo rv-ciano">Aplicativo Android</span>
                    <h2 class="display-5 mt-2 revelar">O técnico anda pelo galpão. O sistema vai junto.</h2>
                    <p class="lead rv-texto-suave revelar">Feito em Flutter para quem trabalha em pé: entrada e saída de material,
                    ordens de serviço, mapa da prateleira e o modo pessoal, tudo no celular.</p>
                    <ul class="rv-lista-check revelar">
                        <li><i class="bi bi-wifi-off"></i><span><strong>Funciona sem internet.</strong> O SQLite guarda as alterações e manda quando o sinal volta.</span></li>
                        <li><i class="bi bi-broadcast"></i><span><strong>Central de conexão.</strong> Mostra o servidor, a latência e o que está pendente.</span></li>
                        <li><i class="bi bi-box-seam"></i><span><strong>Mesmas regras do web.</strong> Saldo conferido antes de qualquer saída.</span></li>
                    </ul>
                    <a href="<?= $repositorio ?>" target="_blank" rel="noopener" class="btn btn-light mt-2 revelar"><i class="bi bi-android2 me-2"></i>Baixar para Android</a>
                </div>
                <div class="col-12 col-lg-7 order-lg-1">
                    <div class="rv-tres-celulares revelar">
                        <div class="rv-celular rv-celular-lado">
                            <div class="rv-celular-tela"><img src="assets/telas/mobile/mapa-2d.jpg" alt="Mapa 2D no celular" loading="lazy"></div>
                        </div>
                        <div class="rv-celular rv-celular-centro">
                            <div class="rv-celular-tela rv-ciclo" data-ciclo="3000">
                                <?php foreach ($telasMobile as $i => $tela): if ($i > 7) break; ?>
                                <img src="assets/telas/mobile/<?= $tela['arquivo'] ?>.jpg" class="<?= $i ? '' : 'ativa' ?>" alt="<?= $tela['titulo'] ?>" loading="lazy">
                                <?php endforeach; ?>
                            </div>
                        </div>
                        <div class="rv-celular rv-celular-lado">
                            <div class="rv-celular-tela"><img src="assets/telas/mobile/conexao.jpg" alt="Central de conexão" loading="lazy"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
   </section>

   <section id="showcase" class="rv-secao">
        <div class="container-lg">
            <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
                <div class="revelar">
                    <span class="rv-rotulo text-primary">Interface</span>
                    <h2 class="display-5 mt-2 mb-0">Conheça o sistema</h2>
                </div>
                <a href="telas.php" class="btn btn-outline-primary revelar">Ver as <?= count($telasWeb) + count($telasMobile) ?> telas <i class="bi bi-arrow-right ms-1"></i></a>
            </div>
            <div class="rv-carrossel revelar">
                <?php foreach (['launchpad', 'wms-estoque', 'editor-cad', 'ficha-ativo', 'kaplan-meier', 'pessoal-ia'] as $arquivo):
                    $tela = current(array_filter($telasWeb, fn($t) => $t['arquivo'] === $arquivo)); ?>
                <a href="telas.php#<?= $arquivo ?>" class="rv-cartao-tela">
                    <div class="browser-frame">
                        <div class="browser-frame-bar"><span></span><span></span><span></span></div>
                        <img src="assets/telas/web/<?= $arquivo ?>.jpg" class="w-100" alt="<?= $tela['titulo'] ?>" loading="lazy">
                    </div>
                    <strong><?= $tela['titulo'] ?></strong>
                    <small><?= $tela['texto'] ?></small>
                </a>
                <?php endforeach; ?>
            </div>
        </div>
   </section>

   <section id="equipe" class="rv-secao rv-secao-cinza">
        <div class="container-lg">
            <div class="row g-5">
                <div class="col-12 col-lg-5 revelar">
                    <span class="rv-rotulo text-primary">Quem fez</span>
                    <h2 class="display-6 mt-2">Feito no COTIL, testado no chão de fábrica.</h2>
                    <p class="text-muted">Antes de escrever código, a gente conversou com quem trabalha em almoxarifado e
                    manutenção. Muita decisão do sistema veio dessas conversas.</p>
                    <a href="documentacao.php" class="btn btn-primary mt-2">Ler a documentação</a>
                </div>
                <div class="col-12 col-lg-7">
                    <div class="row g-3">
                        <?php foreach (array_merge($equipe, $banca) as $i => $pessoa): ?>
                        <div class="col-12 col-sm-6 revelar" style="--atraso: <?= $i * 70 ?>ms">
                            <div class="rv-pessoa">
                                <span class="rv-avatar<?= $i < count($equipe) ? ' autor' : '' ?>"><?= iniciais($pessoa['nome']) ?></span>
                                <div>
                                    <strong><?= $pessoa['nome'] ?></strong>
                                    <small><?= $pessoa['papel'] ?></small>
                                </div>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
        </div>
   </section>

   <section class="rv-chamada gradient">
        <div class="container-lg text-center text-light">
            <h2 class="display-5 revelar">Bora organizar esse estoque?</h2>
            <p class="lead text-white-50 revelar">Instalador para Windows e Linux, APK para Android e a versão web no navegador.</p>
            <div class="d-flex flex-wrap justify-content-center gap-3 mt-4 revelar">
                <a href="downloadDesktop.php" class="btn btn-lg btn-light px-4"><i class="bi bi-pc-display me-2"></i>Desktop</a>
                <a href="downloadMobile.php" class="btn btn-lg btn-outline-light px-4"><i class="bi bi-android2 me-2"></i>Android</a>
            </div>
        </div>
   </section>

<?php include "includes/rodape.php"; ?>
