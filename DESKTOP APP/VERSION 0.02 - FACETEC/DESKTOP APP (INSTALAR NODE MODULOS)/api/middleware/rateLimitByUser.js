const rateLimit = require('express-rate-limit');

// Bloqueio por tentativa de login (baseado no IP e no e-mail informado)
// O express-rate-limit permite usar keyGenerator para mudar o agrupamento
const userRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos de janela
    max: 10,                 // 10 tentativas
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Zera quando consegue logar
    keyGenerator: (req, res) => {
        // Agrupa pelo e-mail e IP juntos
        const email = req.body.email ? req.body.email.toLowerCase().trim() : 'no-email';
        return req.ip + '_' + email;
    },
    message: { error: 'Muitas tentativas falhas para esta conta. Por segurança, aguarde 5 minutos.' }
});

module.exports = userRateLimiter;
