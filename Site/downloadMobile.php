<?php
$pagina = 'download';
$titulo = 'Versão Mobile · ASTHA RAVEN';
$descricao = 'Aplicativo Android do ASTHA RAVEN, feito em Flutter, que funciona mesmo sem internet.';
include "includes/navbar.php";

$passos = [
    'Baixe o arquivo RAVEN_ASTHA.apk no celular.',
    'Quando o Android perguntar, permita a instalação de apps desta fonte.',
    'Abra o app e, na Central de conexão, informe o endereço do servidor (o mesmo IP do computador com a API).',
    'Entre com o mesmo usuário e senha da versão web.',
];
?>

    <section class="rv-secao rv-secao-escura rv-secao-mobile" id="intro" style="padding-top: 140px">
        <div class="rv-hero-fundo" aria-hidden="true"></div>
        <div class="container-lg position-relative">
            <div class="row align-items-center g-5">
                <div class="col-lg-6 text-light">
                    <span class="rv-selo revelar"><span class="ponto"></span>Android · Flutter</span>
                    <h1 class="display-2 mt-3 revelar">Versão Mobile</h1>
                    <p class="lead rv-texto-suave revelar">O almoxarife não fica sentado. O aplicativo leva estoque, ordens de
                    manutenção e o mapa do galpão para o bolso, e continua funcionando onde o Wi-Fi não chega.</p>

                    <ul class="rv-lista-check revelar">
                        <li><i class="bi bi-wifi-off"></i><span><strong>Funciona sem internet.</strong> O SQLite guarda as alterações e manda quando o sinal volta.</span></li>
                        <li><i class="bi bi-broadcast"></i><span><strong>Central de conexão.</strong> Mostra o servidor, a latência e o que está pendente.</span></li>
                        <li><i class="bi bi-badge-3d"></i><span><strong>Mapa 2D e 3D.</strong> A mesma planta do galpão, com toque para girar.</span></li>
                    </ul>

                    <div class="d-flex flex-wrap align-items-center gap-3 revelar">
                        <a href="<?= $repositorio ?>" target="_blank" rel="noopener" class="btn btn-primary btn-lg"><i class="bi bi-android2 me-2"></i>Baixar APK</a>
                        <code class="rv-texto-suave">RAVEN_ASTHA.apk</code>
                    </div>
                </div>

                <div class="col-lg-6">
                    <div class="rv-tres-celulares revelar">
                        <div class="rv-celular rv-celular-lado">
                            <div class="rv-celular-tela"><img src="assets/telas/mobile/conexao.jpg" alt="Central de conexão" loading="lazy"></div>
                        </div>
                        <div class="rv-celular rv-celular-centro">
                            <div class="rv-celular-tela rv-ciclo" data-ciclo="3000">
                                <?php foreach ($telasMobile as $i => $tela): ?>
                                <img src="assets/telas/mobile/<?= $tela['arquivo'] ?>.jpg" class="<?= $i ? '' : 'ativa' ?>" alt="<?= $tela['titulo'] ?>" loading="lazy">
                                <?php endforeach; ?>
                            </div>
                        </div>
                        <div class="rv-celular rv-celular-lado">
                            <div class="rv-celular-tela"><img src="assets/telas/mobile/mapa-3d.jpg" alt="Mapa 3D" loading="lazy"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="rv-secao">
        <div class="container-md">
            <div class="row g-5">
                <div class="col-lg-6">
                    <h2 class="fw-bold mb-4">Como instalar</h2>
                    <ol class="rv-passos">
                        <?php foreach ($passos as $passo): ?>
                        <li><?= $passo ?></li>
                        <?php endforeach; ?>
                    </ol>
                </div>
                <div class="col-lg-6">
                    <h2 class="fw-bold mb-4">Situação</h2>
                    <div class="d-flex flex-column gap-3">
                        <div class="rv-rnf"><i class="bi bi-android2"></i><h6>Android <span class="badge rounded-pill text-bg-success ms-1">Testado</span></h6>
                            <p>Validado durante os testes do laboratório, com e sem conexão.</p></div>
                        <div class="rv-rnf"><i class="bi bi-apple"></i><h6>iOS <span class="badge rounded-pill text-bg-warning ms-1">Sem teste</span></h6>
                            <p>O Flutter gera a versão, mas o projeto não teve um iPhone nem um Mac para compilar e testar.</p></div>
                    </div>
                </div>
            </div>
            <p class="text-muted mt-5 text-center">Prefere o computador? <a href="downloadDesktop.php">Ver versões para Desktop</a>.</p>
        </div>
    </section>

<?php include "includes/rodape.php"; ?>
