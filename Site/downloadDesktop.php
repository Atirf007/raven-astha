<?php
$pagina = 'download';
$titulo = 'Download · ASTHA RAVEN';
$descricao = 'Baixe o ASTHA RAVEN para Windows, Linux, macOS ou Android.';
include "includes/navbar.php";

$plataformas = [
    'windows' => [
        'nome' => 'Windows',
        'icone' => 'bi-windows',
        'arquivo' => 'ASTHA-RAVEN-Setup.exe',
        'situacao' => ['Testado', 'success'],
        'texto' => 'Baixe o ASTHA RAVEN pelo instalador para Windows, seguindo o passo a passo.',
        'passos' => [
            'Baixe o arquivo ASTHA-RAVEN-Setup.exe.',
            'Se o Windows SmartScreen avisar, clique em "Mais informações" e depois em "Executar assim mesmo".',
            'Escolha a pasta de instalação e espere terminar.',
            'Abra pelo atalho da área de trabalho e informe o endereço do servidor na primeira tela.',
        ],
    ],
    'linux' => [
        'nome' => 'Linux',
        'icone' => 'bi-tux',
        'arquivo' => 'ASTHA-RAVEN.AppImage',
        'situacao' => ['Testado', 'success'],
        'texto' => 'A distribuição para plataformas Linux é feita através de AppImage. Lembre-se de permitir que o arquivo seja executado como um programa:',
        'passos' => [
            'Baixe o arquivo ASTHA-RAVEN.AppImage.',
            'Clique com o botão direito sobre o arquivo > Propriedades > Permissões > Permitir execução do arquivo como um programa.',
            'Ou, pelo terminal: chmod +x ASTHA-RAVEN.AppImage',
            'Dê dois cliques para abrir. Não precisa instalar nada.',
        ],
    ],
    'macos' => [
        'nome' => 'macOS',
        'icone' => 'bi-apple',
        'arquivo' => 'ASTHA-RAVEN-Setup.pkg',
        'situacao' => ['Sem teste', 'warning'],
        'texto' => 'Baixe o ASTHA RAVEN através de um .pkg para rodá-lo em computadores Apple. O pacote é gerado, mas ainda não foi testado por falta de um Mac no projeto.',
        'passos' => [
            'Baixe o arquivo ASTHA-RAVEN-Setup.pkg.',
            'Se o macOS bloquear, vá em Ajustes do Sistema > Privacidade e Segurança > Abrir mesmo assim.',
            'Siga o instalador e abra pela pasta Aplicativos.',
        ],
    ],
];

?>

    <header class="rv-topo-pagina">
        <div class="rv-hero-fundo" aria-hidden="true"></div>
        <div class="container-lg position-relative text-center">
            <span class="rv-selo revelar"><span class="ponto"></span>Electron · Windows, Linux e macOS</span>
            <h1 class="mt-3 revelar">Download do ASTHA RAVEN</h1>
            <p class="lead rv-texto-suave col-lg-7 mx-auto revelar">O ASTHA RAVEN é uma aplicação desktop (Electron) disponível
            para as principais plataformas. Também roda direto no navegador e tem um aplicativo para Android.</p>
        </div>
    </header>

    <section class="rv-secao">
        <div class="container-lg">
            <div class="row g-4">
                <?php foreach ($plataformas as $chave => $p): ?>
                <div class="col-12 col-md-6 col-lg-3 revelar">
                    <div class="rv-download">
                        <i class="bi <?= $p['icone'] ?>"></i>
                        <h3><?= $p['nome'] ?></h3>
                        <span class="badge rounded-pill text-bg-<?= $p['situacao'][1] ?> align-self-start mb-3"><?= $p['situacao'][0] ?></span>
                        <code class="mb-4"><?= $p['arquivo'] ?></code>
                        <a href="<?= $repositorio ?>" target="_blank" rel="noopener" class="btn btn-primary mt-auto"><i class="bi bi-download me-2"></i>Baixar</a>
                        <a href="#<?= $chave ?>-download" class="small text-muted text-center mt-2" data-bs-toggle="collapse">Como instalar</a>
                    </div>
                </div>
                <?php endforeach; ?>

                <div class="col-12 col-md-6 col-lg-3 revelar">
                    <div class="rv-download">
                        <i class="bi bi-globe2"></i>
                        <h3>Navegador</h3>
                        <span class="badge rounded-pill text-bg-success align-self-start mb-3">Testado</span>
                        <code class="mb-4">localhost:3000/app</code>
                        <a href="telas.php" class="btn btn-outline-primary mt-auto">Ver as telas</a>
                        <span class="small text-muted text-center mt-2">Sem instalar nada</span>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section class="pb-5">
        <div class="container-md">
            <h2 class="fw-bold mb-4">Passo a passo</h2>
            <div class="accordion" id="platforms">
                <?php foreach ($plataformas as $chave => $p): ?>
                <div class="accordion-item">
                    <h2 class="accordion-header" id="heading-<?= $chave ?>">
                        <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse"
                        data-bs-target="#<?= $chave ?>-download" aria-expanded="false" aria-controls="<?= $chave ?>-download">
                            <i class="bi <?= $p['icone'] ?> me-2"></i><?= $p['nome'] ?>
                        </button>
                    </h2>
                    <div class="accordion-collapse collapse" id="<?= $chave ?>-download" aria-labelledby="heading-<?= $chave ?>"
                    data-bs-parent="#platforms">
                        <div class="accordion-body">
                            <p class="mt-2 mb-4"><?= $p['texto'] ?></p>
                            <ol class="rv-passos mb-4">
                                <?php foreach ($p['passos'] as $passo): ?>
                                <li><?= $passo ?></li>
                                <?php endforeach; ?>
                            </ol>
                            <a href="<?= $repositorio ?>" target="_blank" rel="noopener" class="btn bg-primary text-light">Baixar</a><small class="text-muted ms-2"><?= $p['arquivo'] ?></small>
                        </div>
                    </div>
                </div>
                <?php endforeach; ?>
            </div>

            <div class="rv-rnf mt-5">
                <i class="bi bi-hdd-network"></i>
                <h6>Antes de instalar</h6>
                <p>O programa é a interface. Os dados ficam na API em Node.js com MySQL 8.0, que precisa estar rodando em
                algum computador da rede. Na primeira abertura é só informar o endereço dela.</p>
            </div>

            <p class="text-muted mt-5 text-center">Vai usar no celular? <a href="downloadMobile.php">Veja a versão para Android</a>.</p>
        </div>
    </section>

<?php include "includes/rodape.php"; ?>
