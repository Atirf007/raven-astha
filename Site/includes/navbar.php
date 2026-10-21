<?php
require_once __DIR__ . '/dados.php';

$pagina = $pagina ?? 'inicio';
$titulo = $titulo ?? 'ASTHA RAVEN';
$descricao = $descricao ?? 'Sistema multiplataforma para gestão de estoques, ativos industriais e mapeamento 2D/3D. Web, Desktop (Electron) e Mobile (Flutter).';

$menu = [
    'inicio' => ['Início', 'index.php'],
    'modulos' => ['Módulos', 'index.php#modulos'],
    'telas' => ['Telas', 'telas.php'],
    'documentacao' => ['Documentação', 'documentacao.php'],
    'download' => ['Download', 'downloadDesktop.php'],
];
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($titulo) ?></title>
    <meta name="description" content="<?= htmlspecialchars($descricao) ?>">
    <meta name="theme-color" content="#0b1120">

    <link rel="icon" type="image/png" href="assets/asthaLogo.png">

    <link rel="stylesheet" href="node_modules/bootstrap-icons/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href="css/main.min.css">
    <link rel="stylesheet" href="css/custom.css">
    <script defer src="js/bootstrap.bundle.js"></script>
    <script defer src="js/site.js"></script>

</head>
<body class="pagina-<?= $pagina ?>">

    <nav class="navbar fixed-top navbar-expand-lg navbar-dark rv-nav" id="topo">
            <div class="container-lg">
                <a class="navbar-brand d-flex align-items-center" href="index.php">
                    <img src="assets/asthaLogo.png" width="36" height="36" class="me-2 rv-nav-logo" alt="">
                    <span class="fw-bold">ASTHA RAVEN</span>
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#main-nav"
                aria-controls="main-nav" aria-expanded="false" aria-label="Abrir menu">
                    <span class="navbar-toggler-icon"></span>
                </button>

                <div class="collapse navbar-collapse" id="main-nav">
                    <ul class="navbar-nav mx-auto">
                        <?php foreach ($menu as $chave => [$nome, $link]): ?>
                        <li class="nav-item">
                            <a class="nav-link<?= $chave === $pagina ? ' active' : '' ?>" href="<?= $link ?>"><?= $nome ?></a>
                        </li>
                        <?php endforeach; ?>
                    </ul>
                    <div class="d-flex gap-2 py-3 py-lg-0">
                        <a href="assets/doc/Documentacao_TCC_Raven_Astah_2026.pdf" class="btn btn-sm btn-outline-light" target="_blank">
                            <i class="bi bi-file-earmark-pdf me-1"></i>TCC
                        </a>
                        <a href="<?= $repositorio ?>" target="_blank" rel="noopener" class="btn btn-sm btn-primary">Baixar<i class="bi bi-arrow-down-short ms-1"></i></a>
                    </div>
                </div>
            </div>
    </nav>
