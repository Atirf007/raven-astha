// Quantities in inventory and maintenance remain in the material's base unit.
// Purchase snapshots remain stable if the conversion catalogue changes later.
async function purchaseSnapshot(connection, orgId, materialId, baseQuantity, unitPrice, requestedUnit) {
  const [rows] = await connection.execute('SELECT m.unit,m.purchase_unit,c.factor FROM materials m LEFT JOIN material_unit_conversions c ON c.material_id=m.id AND BINARY c.org_id=BINARY m.org_id AND BINARY c.from_unit=BINARY m.purchase_unit AND BINARY c.to_unit=BINARY m.unit WHERE m.id=? AND m.org_id=? FOR UPDATE', [materialId, orgId]);
  if (!rows.length) throw Object.assign(new Error('Material não encontrado'), { status: 404 });
  const material = rows[0], baseUnit = material.unit || 'UN';
  const unit = requestedUnit || baseUnit;
  let factor = 1;
  if (unit !== baseUnit) {
    if (unit !== material.purchase_unit || !(Number(material.factor) > 0)) throw Object.assign(new Error('Unidade de compra sem conversão válida'), { status: 400 });
    factor = Number(material.factor);
  }
  const purchaseQuantity = Math.ceil(baseQuantity / factor * 1000 - 1e-8) / 1000;
  return { unit, factor, purchaseQuantity, baseQuantity: Number((purchaseQuantity * factor).toFixed(3)), basePrice: unitPrice / factor, purchasePrice: unitPrice };
}
module.exports = { purchaseSnapshot };
