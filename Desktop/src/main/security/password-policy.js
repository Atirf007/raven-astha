const PASSWORD_ERROR = 'Use uma senha de pelo menos 15 caracteres, com no máximo 72 bytes, sem sequências repetidas ou senhas comuns.';
function validPassword(password) {
  return typeof password === 'string' && [...password].length >= 15
    && Buffer.byteLength(password, 'utf8') <= 72
    && !/^(.)\1+$/u.test(password)
    && !/^(password|senha|123456789|qwerty|administrator|administrador)[\d!@#$]*$/i.test(password);
}
module.exports = { validPassword, PASSWORD_ERROR };
