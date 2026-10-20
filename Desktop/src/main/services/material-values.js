'use strict';
// Match the existing SQL precision. Stock is decimal; min/max thresholds are integers.
function validateMaterialValues(body) {
  for (const [field, places] of [['quantity',3],['min_qty',0],['max_qty',0],['unit_price',2]]) {
    if (body[field] === undefined) continue;
    const value = body[field], scale = 10 ** places;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9 || Math.abs(value * scale - Math.round(value * scale)) > 0.000001) {
      const error = new Error('Quantidade, limites ou preço inválidos. Confira os valores e as casas decimais.');
      error.status = 400; throw error;
    }
  }
  if (typeof body.description !== 'undefined' && (typeof body.description !== 'string' || !body.description.trim() || body.description.length > 300)) {
    const error = new Error('Informe uma descrição válida, com até 300 caracteres.'); error.status = 400; throw error;
  }
}
module.exports = {validateMaterialValues};
