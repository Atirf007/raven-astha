   <?php include "includes/navbar.php"?>


   <header class="gradient" id="intro">
        <div class="container-lg py-5">
            <div class="row align-items-center">
                <div class="col-12 col-lg-6 text-light">
                    <img src="assets/asthaLogo.png" width="70" class="mb-4">
                    <h1 class="display-3 mb-3">ASTHA RAVEN</h1>
                    <p class="lead">Seu parceiro inteligente para gestão de estoque. Rastreabilidade de entradas e
                    saídas, identificação de itens por QR Code, controle de acesso por perfil de usuário e um
                    dashboard gerencial completo — tudo em um único sistema.</p>
                    <div class="d-flex flex-wrap gap-3 mt-4 mb-5 mb-lg-0">
                        <a class="btn btn-lg bg-primary text-light" href="downloadDesktop.php">Baixar ASTHA RAVEN</a>
                        <a class="btn btn-lg btn-outline-light" href="#showcase">Ver a interface</a>
                    </div>
                </div>
                <div class="col-12 col-lg-6">
                    <div class="browser-frame mb-5 mb-lg-0">
                        <div class="browser-frame-bar">
                            <span></span><span></span><span></span>
                        </div>
                        <img src="assets/screenshot-dashboard.png" class="w-100" alt="Dashboard do ASTHA RAVEN">
                    </div>
                </div>
            </div>
        </div>

        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320">
            <path fill="#ffffff" fill-opacity="1" d="M0,256L48,261.3C96,267,192,277,288,282.7C384,288,480,288,576,282.7C672,277,768,267,864,256C960,245,1056,235,1152,218.7C1248,203,1344,181,1392,170.7L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
    </header>

   <section id="sobre">
        <div class="container-md">
            <div class="d-flex flex-column justify-content-center align-items-center">
                <h1 class="display-5 text-center">Organização Simplificada</h1>
                <p class="lead my-4">O controle de materiais em ambientes técnicos — laboratórios, oficinas e
                    almoxarifados — ainda é, com frequência, feito por planilhas soltas, sem rastreabilidade de
                    quem retirou cada item e sem alerta de estoque mínimo. O ASTHA RAVEN substitui o controle
                    manual por um sistema informatizado, rastreável e de rápida operação via leitura de código QR.</p>
            </div>
        </div>
    </section>

   <section id="features">
        <div class="d-flex flex-column align-items-center">
            <h1 class="display-5 mb-5">Funcionalidades</h1>
        </div>
        <div class="container-lg">
            <div class="row justify-content-center">
                <div class="col-12 col-md-4 mb-4 d-flex align-items-stretch">
                    <div class="card border-primary">
                        <div class="card-body text-center">
                            <i class="bi bi-qr-code-scan h1"></i>
                            <h1 class="card-title">Leitura por QR Code</h1>
                            <p class="card-subtitle lead my-4 text-muted">Retirada Rápida de Itens</p>
                            <div class="card-text text-start">
                                <p><span class="fw-medium">Etiquetas automáticas:</span> cada item cadastrado recebe
                                um código único e uma etiqueta com QR Code gerada automaticamente pelo sistema.</p>
                                <p><span class="fw-medium">Scanner USB (HID):</span> a leitura óptica atualiza o
                                estoque em tempo real, em poucos segundos e sem digitação manual.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-12 col-md-4 mb-4 d-flex align-items-stretch">
                    <div class="card border-primary">
                        <div class="card-body text-center">
                            <i class="bi bi-shield-lock h1"></i>
                            <h1 class="card-title">Controle de Acesso</h1>
                            <p class="card-subtitle lead my-4 text-muted">RBAC por Perfil de Usuário</p>
                            <div class="card-text text-start">
                                <p>Ações críticas, como a remoção de um item, ficam restritas a perfis autorizados,
                                com validação sempre no processo principal da aplicação — evitando alterações não
                                autorizadas no estoque.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-12 col-md-4 mb-4 d-flex align-items-stretch">
                    <div class="card border-primary">
                        <div class="card-body text-center">
                            <i class="bi bi-bar-chart-line h1"></i>
                            <h1 class="card-title">Dashboard Gerencial</h1>
                            <p class="card-subtitle lead my-4 text-muted">Indicadores em Tempo Real</p>
                            <div class="card-text text-start">
                                <p>Rastreabilidade completa de entradas e saídas, alertas automáticos de itens
                                abaixo do estoque mínimo e uma visão gerencial de toda a movimentação.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
   </section>

   <section id="showcase" class="bg-light">
        <div class="d-flex flex-column align-items-center text-center mb-5">
            <h1 class="display-5">Conheça o Sistema</h1>
            <p class="lead text-muted col-12 col-md-8">Do login à movimentação de estoque, o ASTHA RAVEN organiza
            cada etapa do processo em módulos claros e objetivos.</p>
        </div>
        <div class="container-lg">
            <ul class="nav nav-pills justify-content-center flex-wrap gap-2 mb-5" id="showcase-tabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="tab-login-btn" data-bs-toggle="pill" data-bs-target="#tab-login" type="button" role="tab">Login</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="tab-home-btn" data-bs-toggle="pill" data-bs-target="#tab-home" type="button" role="tab">Painel Corporativo</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="tab-dashboard-btn" data-bs-toggle="pill" data-bs-target="#tab-dashboard" type="button" role="tab">Dashboard de Estoque</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="tab-mapa-btn" data-bs-toggle="pill" data-bs-target="#tab-mapa" type="button" role="tab">Mapa do Estoque</button>
                </li>
            </ul>

            <div class="tab-content" id="showcase-tabs-content">
                <div class="tab-pane fade show active" id="tab-login" role="tabpanel">
                    <div class="row align-items-center g-5">
                        <div class="col-12 col-lg-5">
                            <h2 class="h1">Acesso seguro</h2>
                            <p class="lead text-muted">Login por crachá ou e-mail, com autenticação protegida.
                            Cada usuário acessa apenas o que sua função permite.</p>
                        </div>
                        <div class="col-12 col-lg-7">
                            <div class="browser-frame">
                                <div class="browser-frame-bar"><span></span><span></span><span></span></div>
                                <img src="assets/screenshot-login.png" class="w-100" alt="Tela de login do ASTHA RAVEN">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="tab-pane fade" id="tab-home" role="tabpanel">
                    <div class="row align-items-center g-5">
                        <div class="col-12 col-lg-5">
                            <h2 class="h1">Painel corporativo</h2>
                            <p class="lead text-muted">Um Launchpad reúne o status do WMS Core, integrações com
                            APIs e ERPs, saúde do sistema em tempo real e as configurações da empresa em um só
                            lugar.</p>
                        </div>
                        <div class="col-12 col-lg-7">
                            <div class="browser-frame">
                                <div class="browser-frame-bar"><span></span><span></span><span></span></div>
                                <img src="assets/screenshot-home.png" class="w-100" alt="Painel corporativo do ASTHA RAVEN">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="tab-pane fade" id="tab-dashboard" role="tabpanel">
                    <div class="row align-items-center g-5">
                        <div class="col-12 col-lg-5">
                            <h2 class="h1">Dashboard de estoque</h2>
                            <p class="lead text-muted">Materiais cadastrados, itens em nível crítico, estoque
                            zerado, volume total e valor em estoque, com distribuição visual e uma lista de ações
                            imediatas para o que precisa de atenção.</p>
                        </div>
                        <div class="col-12 col-lg-7">
                            <div class="browser-frame">
                                <div class="browser-frame-bar"><span></span><span></span><span></span></div>
                                <img src="assets/screenshot-dashboard.png" class="w-100" alt="Dashboard de estoque do ASTHA RAVEN">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="tab-pane fade" id="tab-mapa" role="tabpanel">
                    <div class="row align-items-center g-5">
                        <div class="col-12 col-lg-5">
                            <h2 class="h1">Mapa do estoque</h2>
                            <p class="lead text-muted">Importe ou crie mapas 2D do estoque, defina setores e
                            localize itens visualmente, com editor CAD próprio para representar o espaço físico.</p>
                        </div>
                        <div class="col-12 col-lg-7">
                            <div class="browser-frame">
                                <div class="browser-frame-bar"><span></span><span></span><span></span></div>
                                <img src="assets/screenshot-mapa2d.png" class="w-100" alt="Mapa 2D do estoque no ASTHA RAVEN">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
   </section>

   <footer class="gradient">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320">
            <path fill="#ffffff" fill-opacity="1" d="M0,256L120,240C240,224,480,192,720,176C960,160,1200,160,1320,160L1440,160L1440,0L1320,0C1200,0,960,0,720,0C480,0,240,0,120,0L0,0Z"></path>
        </svg>
    </footer>
</body>
</html>
