<?php include "includes/navbar.php"?>

   <section id="intro">
        <div class="container-md">
            <div class="d-flex flex-column align-items-center">
                <h1 class="display-2 text-center">Download do ASTHA RAVEN</h1>
                <p class="lead text-center">O ASTHA RAVEN é uma aplicação desktop (Electron) disponível para as
                principais plataformas.</p>
            </div>
        </div>
   </section>

   <section>
        <div class="container-md">
            <div class="accordion" id="platforms">
                <div class="accordion-item">
                    <h2 class="accordion-header" id="heading-windows">
                        <button class="accordion-button" type="button" data-bs-toggle="collapse"
                        data-bs-target="#windows-download" aria-expanded="false" aria-controls="windows-download">
                            <i class="bi bi-windows me-2"></i>Windows
                        </button>
                    </h2>
                    <div class="accordion-collapse collapse" id="windows-download" aria-labelledby="heading-windows"
                    data-bs-parent="#platforms">
                        <div class="accordion-body">
                            <p class="mt-2 mb-5">Baixe o ASTHA RAVEN pelo instalador para Windows, seguindo o passo a passo.</p>
                            <a href="#" class="btn bg-primary text-light">Baixar</a><small class="text-muted ms-2">ASTHA-RAVEN-Setup.exe</small>
                        </div>
                    </div>
                </div>

                 <div class="accordion-item">
                    <h2 class="accordion-header" id="heading-linux">
                        <button class="accordion-button" type="button" data-bs-toggle="collapse"
                        data-bs-target="#linux-download" aria-expanded="false" aria-controls="linux-download">
                            <i class="bi bi-tux me-2"></i>Linux
                        </button>
                    </h2>
                    <div class="accordion-collapse collapse" id="linux-download" aria-labelledby="heading-linux"
                    data-bs-parent="#platforms">
                        <div class="accordion-body">
                            <p class="mt-2 mb-4">A distribuição para plataformas Linux é feita através de AppImage. Lembre-se de 
                            permitir que o arquivo seja executado como um programa: </p>
                            <p class="fw-medium text-secondary mb-5">Clicar com o botão direito do mouse sobre o arquivo .AppImage > Preferências > Permissões > 
                            Permitir execução do arquivo como um programa</p>
                            <a href="#" class="btn bg-primary text-light">Baixar</a><small class="text-muted ms-2">ASTHA-RAVEN.AppImage</small>
                        </div>
                    </div>
                </div>

                 <div class="accordion-item">
                    <h2 class="accordion-header" id="heading-macos">
                        <button class="accordion-button" type="button" data-bs-toggle="collapse"
                        data-bs-target="#macos-download" aria-expanded="false" aria-controls="macos-download">
                            <i class="bi bi-apple me-2"></i>MacOs
                        </button>
                    </h2>
                    <div class="accordion-collapse collapse" id="macos-download" aria-labelledby="heading-macos"
                    data-bs-parent="#platforms">
                        <div class="accordion-body">
                            <p class="mt-2 mb-5">Baixe o ASTHA RAVEN através de um .pkg para rodá-lo em computadores Apple</p>
                            <a href="#" class="btn bg-primary text-light">Baixar</a><small class="text-muted ms-2">ASTHA-RAVEN-Setup.pkg</small>
                        </div>
                    </div>
                </div>
            </div>
            <p class="text-muted mt-4 text-center">O ASTHA RAVEN é uma aplicação desktop e, no momento, não possui versão mobile.</p>
        </div>
   </section>

   <footer class="gradient">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320">
            <path fill="#ffffff" fill-opacity="1" d="M0,256L120,240C240,224,480,192,720,176C960,160,1200,160,1320,160L1440,160L1440,0L1320,0C1200,0,960,0,720,0C480,0,240,0,120,0L0,0Z"></path>
        </svg>
   </footer>
</body>
</html>
