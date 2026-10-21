// Animações e interações do site do ASTHA RAVEN.
// Tudo em JS puro; o bootstrap.bundle.js continua cuidando do menu e dos accordions.

const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// navbar fica sólida depois que a página rola um pouco
const nav = document.querySelector('.rv-nav');
function conferirNav() {
    nav.classList.toggle('rolou', window.scrollY > 30);
}
window.addEventListener('scroll', conferirNav, { passive: true });
conferirNav();


// elementos que aparecem ao entrar na tela + contadores
function contar(el) {
    const alvo = parseFloat(el.dataset.contar);
    const casas = parseInt(el.dataset.casas || '0');
    const duracao = 1600;
    const inicio = performance.now();

    function passo(agora) {
        const t = Math.min((agora - inicio) / duracao, 1);
        const suave = 1 - Math.pow(1 - t, 3);
        el.textContent = (alvo * suave).toLocaleString('pt-BR', {
            minimumFractionDigits: casas,
            maximumFractionDigits: casas,
        });
        if (t < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
}

const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        const el = entrada.target;
        el.classList.add('visivel');
        el.querySelectorAll('[data-contar]').forEach(contar);
        observador.unobserve(el);
    });
}, { threshold: 0.18 });

document.querySelectorAll('.revelar').forEach((el) => observador.observe(el));

// contadores fora de um .revelar (ex.: cartões flutuantes do topo)
document.querySelectorAll('[data-contar]').forEach((el) => {
    if (!el.closest('.revelar')) setTimeout(() => contar(el), 600);
});


// imagens que trocam sozinhas (telas do topo e celular)
document.querySelectorAll('[data-ciclo]').forEach((caixa) => {
    const imagens = caixa.querySelectorAll('img');
    if (imagens.length < 2 || semMovimento) return;
    let atual = 0;
    setInterval(() => {
        imagens[atual].classList.remove('ativa');
        atual = (atual + 1) % imagens.length;
        imagens[atual].classList.add('ativa');
    }, parseInt(caixa.dataset.ciclo));
});


// paralaxe leve no palco do topo
const palco = document.querySelector('[data-paralaxe]');
if (palco && !semMovimento && window.matchMedia('(pointer: fine)').matches) {
    document.querySelector('.rv-hero').addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 10;
        const y = (e.clientY / window.innerHeight - 0.5) * 8;
        palco.style.transform = `rotateY(${x}deg) rotateX(${-y}deg)`;
    });
}


// módulos: troca sozinho a cada 7s, mas para quando a pessoa clica
const listaModulos = document.querySelector('.rv-modulos');
if (listaModulos) {
    const botoes = [...listaModulos.querySelectorAll('.rv-modulo')];
    const telas = document.querySelectorAll('#telaModulo img');
    let indice = 0;
    let timer;

    function mostrarModulo(i) {
        indice = i;
        botoes.forEach((b, n) => b.classList.toggle('ativo', n === i));
        const chave = botoes[i].dataset.modulo;
        telas.forEach((img) => img.classList.toggle('ativa', img.dataset.modulo === chave));
    }

    botoes.forEach((botao, i) => {
        botao.addEventListener('click', () => {
            clearInterval(timer);
            listaModulos.classList.add('parado');
            mostrarModulo(i);
        });
    });

    if (!semMovimento) {
        timer = setInterval(() => mostrarModulo((indice + 1) % botoes.length), 7000);
    }
}


// busca no armazém isométrico
const moldura = document.querySelector('.rv-armazem-moldura');
if (moldura) {
    const locais = JSON.parse(moldura.dataset.locais);
    const svg = moldura.querySelector('svg');
    const pino = document.getElementById('pinoArmazem');
    const texto = document.getElementById('buscaTexto');
    const resultado = document.getElementById('buscaResultado');
    let vez = 0;

    const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

    async function digitar(palavra) {
        texto.textContent = '';
        for (const letra of palavra) {
            texto.textContent += letra;
            await espera(70 + Math.random() * 60);
        }
    }

    function apontar(item) {
        const caixa = svg.querySelector(`[data-local="${item.local}"]`);
        svg.querySelectorAll('.achado').forEach((v) => v.classList.remove('achado'));
        svg.querySelectorAll('.alvo').forEach((p) => p.classList.remove('alvo'));
        if (!caixa) return;

        caixa.classList.add('achado');
        caixa.closest('.prateleira').classList.add('alvo');
        svg.classList.add('buscando');

        const topo = caixa.querySelector('.topo').getBBox();
        pino.setAttribute('transform', `translate(${topo.x + topo.width / 2} ${topo.y + topo.height / 2 - 4})`);

        document.getElementById('buscaCodigo').textContent = item.codigo;
        document.getElementById('buscaMaterial').textContent = item.material;
        document.getElementById('buscaLocal').textContent = item.local;
        document.getElementById('buscaSaldo').textContent =
            item.status === 'zerado' ? 'saldo zerado' : `saldo ${item.saldo}`;
        resultado.classList.remove('escondido');
    }

    async function rodada() {
        const item = locais[vez % locais.length];
        vez++;
        resultado.classList.add('escondido');
        await digitar(item.material.toLowerCase());
        await espera(350);
        apontar(item);
        await espera(3200);
        rodada();
    }

    // só começa quando o mapa aparece na tela
    new IntersectionObserver((entradas, obs) => {
        if (entradas[0].isIntersecting) {
            obs.disconnect();
            if (semMovimento) apontar(locais[0]);
            else rodada();
        }
    }, { threshold: 0.3 }).observe(moldura);
}


// galeria de telas: filtro + visualização ampliada
const galeria = document.querySelector('.rv-galeria');
if (galeria) {
    const itens = [...galeria.querySelectorAll('.item')];
    const filtros = document.querySelectorAll('.rv-filtros button');

    filtros.forEach((botao) => {
        botao.addEventListener('click', () => {
            filtros.forEach((b) => b.classList.toggle('ativo', b === botao));
            const modulo = botao.dataset.filtro;
            itens.forEach((item) => {
                item.classList.toggle('oculto', modulo !== 'todos' && item.dataset.modulo !== modulo);
            });
        });
    });
}

const lightbox = document.querySelector('.rv-lightbox');
if (lightbox) {
    const imagem = lightbox.querySelector('img');
    const legenda = lightbox.querySelector('figcaption');
    let lista = [];
    let posicao = 0;

    function abrir(i) {
        posicao = (i + lista.length) % lista.length;
        const alvo = lista[posicao];
        imagem.src = alvo.dataset.ampliar;
        imagem.alt = alvo.dataset.titulo;
        legenda.textContent = alvo.dataset.titulo;
        lightbox.classList.add('aberto');
        document.body.style.overflow = 'hidden';
    }
    function fechar() {
        lightbox.classList.remove('aberto');
        document.body.style.overflow = '';
    }

    document.querySelectorAll('[data-ampliar]').forEach((el) => {
        el.addEventListener('click', () => {
            lista = [...document.querySelectorAll('[data-ampliar]')].filter((x) => !x.closest('.oculto'));
            abrir(lista.indexOf(el));
        });
    });

    lightbox.querySelector('.fechar').addEventListener('click', fechar);
    lightbox.querySelector('.anterior').addEventListener('click', () => abrir(posicao - 1));
    lightbox.querySelector('.proxima').addEventListener('click', () => abrir(posicao + 1));
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) fechar(); });
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('aberto')) return;
        if (e.key === 'Escape') fechar();
        if (e.key === 'ArrowLeft') abrir(posicao - 1);
        if (e.key === 'ArrowRight') abrir(posicao + 1);
    });

    // veio de um link tipo telas.php#mapa-3d
    if (location.hash) {
        const alvo = document.querySelector(`[data-id="${location.hash.slice(1)}"]`);
        if (alvo) setTimeout(() => alvo.click(), 400);
    }
}


// menu lateral da documentação marca a seção que está na tela
const menuDoc = document.querySelectorAll('.rv-doc-menu a');
if (menuDoc.length) {
    const vigia = new IntersectionObserver((entradas) => {
        entradas.forEach((entrada) => {
            if (!entrada.isIntersecting) return;
            menuDoc.forEach((a) => a.classList.toggle('atual', a.getAttribute('href') === '#' + entrada.target.id));
        });
    }, { rootMargin: '-40% 0px -55% 0px' });

    menuDoc[0].classList.add('atual');
    menuDoc.forEach((a) => {
        const secao = document.querySelector(a.getAttribute('href'));
        if (secao) vigia.observe(secao);
    });
}
