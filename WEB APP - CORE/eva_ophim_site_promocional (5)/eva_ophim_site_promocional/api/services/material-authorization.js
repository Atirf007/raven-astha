function decideAuthorization(request, status, quantity) {
  const issued = Number(request.issued_quantity), requested = Number(request.requested_quantity);
  const remaining = Number((requested-issued).toFixed(3));
  if (status === 'revoked') {
    if (request.status !== 'approved') throw Object.assign(new Error('Somente um saldo aprovado pode ser revogado'), { status: 409 });
    return { approved: issued, status: 'revoked' };
  }
  if (request.status !== 'draft') throw Object.assign(new Error('Solicitação pendente não encontrada'), { status: 409 });
  if (status === 'rejected') return { approved: issued, status };
  // UI specifies the additional amount; cumulative authorization never forgets issues.
  const additional = quantity === undefined ? remaining : quantity;
  if (typeof additional !== 'number' || !Number.isFinite(additional) || additional < 0.001 || Math.abs(additional*1000-Math.round(additional*1000))>0.000001 || additional > remaining) throw Object.assign(new Error('Quantidade aprovada deve respeitar o saldo solicitado e até três casas decimais'), { status: 400 });
  return { approved: Number((issued + additional).toFixed(3)), status: 'approved' };
}
module.exports = { decideAuthorization };
