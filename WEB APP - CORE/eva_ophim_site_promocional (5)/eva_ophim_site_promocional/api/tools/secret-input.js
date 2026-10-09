'use strict';
// CLI only. Secrets arrive through stdin, never CLI arguments or logs.
module.exports = function secretInput() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    let input = '';
    const timer = setTimeout(() => finish(Error('SECRET_INPUT_TIMEOUT')), 120000);
    function finish(error, value) {
      clearTimeout(timer); process.stdin.removeListener('data', receive);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause(); input = '';
      error ? reject(error) : resolve(value);
    }
    function receive(data) {
      input += data;
      if (Buffer.byteLength(input) > 16384) return finish(Error('SECRET_INPUT_TOO_LARGE'));
      if (input.includes('\n') || input.includes('\r')) {
        try { finish(null, JSON.parse(input.trim())); } catch (_) { finish(Error('SECRET_INPUT_INVALID')); }
      }
    }
    process.stdin.on('data', receive); process.stdin.resume();
    console.log('WAITING_PRIVATE_INPUT');
  });
};
