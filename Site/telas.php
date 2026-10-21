<?php
$pagina = 'telas';
$titulo = 'Telas · ASTHA RAVEN';
$descricao = 'Telas reais do ASTHA RAVEN no navegador, no computador e no celular.';
include "includes/navbar.php";

$porModulo = array_count_values(array_column($telasWeb, 'modulo'));
?>

    <header class="rv-topo-pagina">
        <div class="rv-hero-fundo" aria-hidden="true"></div>
        <div class="container-lg position-relative">
            <span class="rv-selo revelar"><span class="ponto"></span><?= count($telasWeb) ?> telas web · <?= count($telasMobile) ?> telas mobile</span>
            <h1 class="mt-3 revelar">O sistema por dentro</h1>
            <p class="lead rv-texto-suave col-lg-7 revelar">Capturas do ASTHA RAVEN rodando com o banco do laboratório de testes. Os
            materiais, ordens e estudos são hipotéticos, mas os cálculos e as telas são os de verdade.</p>
        </div>
    </header>

    <section class="rv-secao" id="web">
        <div class="container-lg">
            <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
                <div>
                    <span class="rv-rotulo text-primary">Web e Desktop</span>
                    <h2 class="display-6 mt-2 mb-0">No navegador e no Electron</h2>
                </div>
                <p class="text-muted mb-0">Clique numa tela para ampliar. Dá pra navegar com as setas do teclado.</p>
            </div>

            <div class="rv-filtros mb-5" role="toolbar" aria-label="Filtrar por módulo">
                <?php foreach ($filtrosWeb as $chave => $nome): ?>
                <button type="button" class="<?= $chave === 'todos' ? 'ativo' : '' ?>" data-filtro="<?= $chave ?>">
                    <?= $nome ?><span><?= $chave === 'todos' ? count($telasWeb) : ($porModulo[$chave] ?? 0) ?></span>
                </button>
                <?php endforeach; ?>
            </div>

            <div class="rv-galeria">
                <?php foreach ($telasWeb as $i => $tela): ?>
                <div class="item revelar" data-modulo="<?= $tela['modulo'] ?>" style="--atraso: <?= ($i % 3) * 80 ?>ms">
                    <button type="button" data-ampliar="assets/telas/web/<?= $tela['arquivo'] ?>.jpg" data-titulo="<?= $tela['titulo'] ?> — <?= $tela['texto'] ?>" data-id="<?= $tela['arquivo'] ?>">
                        <div class="browser-frame">
                            <div class="browser-frame-bar"><span></span><span></span><span></span></div>
                            <img src="assets/telas/web/<?= $tela['arquivo'] ?>.jpg" alt="<?= $tela['titulo'] ?>" loading="lazy">
                        </div>
                        <strong><?= $tela['titulo'] ?></strong>
                        <small><?= $tela['texto'] ?></small>
                    </button>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
    </section>

    <section class="rv-secao rv-secao-escura" id="mobile">
        <div class="container-lg">
            <div class="row align-items-end g-3 mb-4 text-light">
                <div class="col-lg-7">
                    <span class="rv-rotulo rv-ciano">Android · Flutter</span>
                    <h2 class="display-6 mt-2 mb-0">No celular</h2>
                </div>
                <div class="col-lg-5">
                    <p class="rv-texto-suave mb-0">Arraste para o lado para ver todas. O app guarda os dados em SQLite e
                    funciona mesmo sem internet no galpão.</p>
                </div>
            </div>
            <div class="rv-vitrine-mobile">
                <?php foreach ($telasMobile as $tela): ?>
                <figure>
                    <div class="rv-celular">
                        <div class="rv-celular-tela">
                            <img src="assets/telas/mobile/<?= $tela['arquivo'] ?>.jpg" alt="<?= $tela['titulo'] ?>" loading="lazy">
                        </div>
                    </div>
                    <figcaption><?= $tela['titulo'] ?></figcaption>
                </figure>
                <?php endforeach; ?>
            </div>
        </div>
    </section>

    <div class="rv-lightbox" role="dialog" aria-modal="true" aria-label="Tela ampliada">
        <button type="button" class="fechar" aria-label="Fechar"><i class="bi bi-x-lg"></i></button>
        <button type="button" class="seta anterior" aria-label="Anterior"><i class="bi bi-chevron-left"></i></button>
        <figure>
            <img src="" alt="">
            <figcaption></figcaption>
        </figure>
        <button type="button" class="seta proxima" aria-label="Próxima"><i class="bi bi-chevron-right"></i></button>
    </div>

<?php include "includes/rodape.php"; ?>
