/* Input Validator Middleware */
function validateBody(requiredFields) {
  return (req, res, next) => {
    const missing = requiredFields.filter(f => !req.body[f] || (typeof req.body[f] === 'string' && !req.body[f].trim()));
    if (missing.length > 0) {
      return res.status(400).json({ error: `Campos obrigatórios: ${missing.join(', ')}` });
    }
    // Sanitize string fields
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim().replace(/[<>]/g, '');
      }
    }
    next();
  };
}

function validateEmail(field = 'email') {
  return (req, res, next) => {
    const email = req.body[field];
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    next();
  };
}

module.exports = { validateBody, validateEmail };
