const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// Bloqueio por conta, independente do IP; a cota de rede é aplicada no servidor.
// O express-rate-limit permite usar keyGenerator para mudar o agrupamento
const userRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos de janela
    max: 10,                 // 10 tentativas
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Não contabiliza respostas de sucesso.
    keyGenerator: (req, res) => {
        // Normaliza a identidade sem guardar o endereço em texto no contador.
        const email = typeof req.body?.email === 'string' ? req.body.email.slice(0,255).toLowerCase().trim() : 'invalid-email';
        return crypto.createHash('sha256').update(email).digest('hex');
    },
    message: { error: 'Muitas tentativas falhas para esta conta. Por segurança, aguarde 5 minutos.' }
});

module.exports = userRateLimiter;
