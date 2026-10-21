   <footer class="gradient rv-rodape">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" class="rv-onda" aria-hidden="true">
            <path fill="var(--rv-fundo-pagina, #ffffff)" fill-opacity="1" d="M0,256L120,240C240,224,480,192,720,176C960,160,1200,160,1320,160L1440,160L1440,0L1320,0C1200,0,960,0,720,0C480,0,240,0,120,0L0,0Z"></path>
        </svg>

        <div class="container-lg text-light">
            <div class="row g-5">
                <div class="col-12 col-lg-5">
                    <div class="d-flex align-items-center mb-3">
                        <img src="assets/asthaLogo.png" width="44" class="me-2 rounded-3" alt="">
                        <span class="h4 mb-0">ASTHA RAVEN</span>
                    </div>
                    <p class="text-white-50">Trabalho de Conclusão de Curso do Técnico em Desenvolvimento de Sistemas,
                    Colégio Técnico de Limeira (COTIL / Unicamp), 2026.</p>
                    <p class="small text-white-50 mb-0">
                        <?php foreach ($equipe as $i => $pessoa): ?><?= $i ? ' e ' : '' ?><?= $pessoa['nome'] ?><?php endforeach; ?>
                    </p>
                </div>
                <div class="col-6 col-lg-2 offset-lg-1">
                    <h6 class="rv-rotulo text-white-50">Site</h6>
                    <ul class="list-unstyled rv-links-rodape">
                        <li><a href="index.php">Início</a></li>
                        <li><a href="index.php#modulos">Módulos</a></li>
                        <li><a href="telas.php">Telas</a></li>
                        <li><a href="documentacao.php">Documentação</a></li>
                    </ul>
                </div>
                <div class="col-6 col-lg-2">
                    <h6 class="rv-rotulo text-white-50">Baixar</h6>
                    <ul class="list-unstyled rv-links-rodape">
                        <li><a href="downloadDesktop.php">Desktop</a></li>
                        <li><a href="downloadMobile.php">Android</a></li>
                        <li><a href="<?= $repositorio ?>" target="_blank" rel="noopener"><i class="bi bi-github me-1"></i>GitHub</a></li>
                        <li><a href="assets/doc/Documentacao_TCC_Raven_Astah_2026.pdf" target="_blank">TCC em PDF</a></li>
                    </ul>
                </div>
                <div class="col-12 col-lg-2">
                    <h6 class="rv-rotulo text-white-50">Orientação</h6>
                    <ul class="list-unstyled rv-links-rodape small">
                        <?php foreach ($banca as $professora): ?>
                        <li><?= $professora['nome'] ?></li>
                        <?php endforeach; ?>
                    </ul>
                </div>
            </div>
            <hr class="border-light opacity-25 my-4">
            <div class="d-flex flex-wrap justify-content-between small text-white-50 gap-2">
                <span>© <?= date('Y') ?> Raven Astah · Limeira, SP</span>
                <a href="#topo" class="text-white-50 text-decoration-none">Voltar ao topo <i class="bi bi-arrow-up"></i></a>
            </div>
        </div>
    </footer>
</body>
</html>
