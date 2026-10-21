<?php
// Desenho isométrico do armazém do laboratório (mesma planta usada no app: prateleiras A1 a B3).
// Cada prateleira tem 3 níveis e 4 posições, igual ao blueprint cadastrado no sistema.

const ESCALA = 27;
const ORIGEM_X = 190;
const ORIGEM_Y = 70;

function iso($x, $y, $z = 0)
{
    $sx = ORIGEM_X + ($x - $y) * 0.866 * ESCALA;
    $sy = ORIGEM_Y + ($x + $y) * 0.5 * ESCALA - $z * ESCALA;
    return round($sx, 1) . ',' . round($sy, 1);
}

function face($pontos, $classe, $extra = '')
{
    $lista = implode(' ', array_map(fn($p) => iso(...$p), $pontos));
    return "<polygon points=\"$lista\" class=\"$classe\" $extra/>";
}

function linha($x1, $y1, $x2, $y2, $classe)
{
    [$ax, $ay] = explode(',', iso($x1, $y1));
    [$bx, $by] = explode(',', iso($x2, $y2));
    return "<line x1=\"$ax\" y1=\"$ay\" x2=\"$bx\" y2=\"$by\" class=\"$classe\"/>";
}

// caixa em perspectiva: só desenha as 3 faces que aparecem para quem olha
function caixa($x, $y, $z, $w, $d, $h, $classe, $extra = '')
{
    $topo = face([[$x, $y, $z + $h], [$x + $w, $y, $z + $h], [$x + $w, $y + $d, $z + $h], [$x, $y + $d, $z + $h]], 'topo');
    $frente = face([[$x, $y + $d, $z], [$x + $w, $y + $d, $z], [$x + $w, $y + $d, $z + $h], [$x, $y + $d, $z + $h]], 'frente');
    $lado = face([[$x + $w, $y, $z], [$x + $w, $y + $d, $z], [$x + $w, $y + $d, $z + $h], [$x + $w, $y, $z + $h]], 'lado');
    return "<g class=\"$classe\" $extra>$lado$frente$topo</g>";
}

$prateleiras = [
    'A1' => [1, 0.6], 'A2' => [1, 2.4], 'A3' => [1, 4.2],
    'B1' => [7, 0.6], 'B2' => [7, 2.4], 'B3' => [7, 4.2],
];
$largura = 4.2;
$profundidade = 0.8;
$alturaNivel = 0.62;

$ocupadas = [];
foreach ($localizacoes as $item) {
    $ocupadas[$item['local']] = $item;
}

// as do fundo primeiro, senão a da frente fica por baixo
uksort($prateleiras, fn($a, $b) => array_sum($prateleiras[$a]) <=> array_sum($prateleiras[$b]));
?>
<svg viewBox="0 0 470 360" class="rv-armazem" role="img" aria-label="Armazém do laboratório em perspectiva, com seis prateleiras">
    <?= face([[0, 0], [12.4, 0], [12.4, 6.2], [0, 6.2]], 'piso') ?>
    <?php for ($i = 1; $i < 12.4; $i++) echo linha($i, 0, $i, 6.2, 'grade'); ?>
    <?php for ($j = 1; $j < 6.2; $j++) echo linha(0, $j, 12.4, $j, 'grade'); ?>
    <?= face([[5.9, 0.2], [6.1, 0.2], [6.1, 6], [5.9, 6]], 'faixa') ?>

    <?php foreach ($prateleiras as $codigo => [$px, $py]): ?>
    <g class="prateleira" data-prateleira="<?= $codigo ?>">
        <?= caixa($px, $py, 0, 0.08, 0.08, 1.95, 'coluna') ?>
        <?= caixa($px + $largura - 0.08, $py, 0, 0.08, 0.08, 1.95, 'coluna') ?>
        <?php for ($nivel = 1; $nivel <= 3; $nivel++):
            $z = ($nivel - 1) * $alturaNivel + 0.05; ?>
            <?= caixa($px, $py, $z, $largura, $profundidade, 0.05, 'tabua') ?>
            <?php for ($pos = 1; $pos <= 4; $pos++):
                $local = "$codigo-N$nivel-P$pos";
                if (!isset($ocupadas[$local])) continue;
                $item = $ocupadas[$local]; ?>
                <?= caixa($px + ($pos - 1) * 1.05 + 0.14, $py + 0.08, $z + 0.05, 0.78, 0.62, 0.42, 'volume status-' . $item['status'], 'data-local="' . $local . '"') ?>
            <?php endfor; ?>
        <?php endfor; ?>
        <?= caixa($px, $py + $profundidade - 0.08, 0, 0.08, 0.08, 1.95, 'coluna') ?>
        <?= caixa($px + $largura - 0.08, $py + $profundidade - 0.08, 0, 0.08, 0.08, 1.95, 'coluna') ?>
        <?php [$tx, $ty] = explode(',', iso($px - 0.35, $py + $profundidade + 0.1, 0)); ?>
        <text x="<?= $tx ?>" y="<?= $ty ?>" class="etiqueta"><?= $codigo ?></text>
    </g>
    <?php endforeach; ?>

    <g class="rv-pino" id="pinoArmazem" transform="translate(-100 -100)">
        <circle r="16" class="pulso"/>
        <path d="M0 0 L-7 -14 A8 8 0 1 1 7 -14 Z" class="gota"/>
        <circle cy="-17" r="3" fill="#0b1120"/>
    </g>
</svg>
