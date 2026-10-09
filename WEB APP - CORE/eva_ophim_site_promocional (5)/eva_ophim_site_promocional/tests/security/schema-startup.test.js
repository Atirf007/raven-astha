const test = require('node:test');
const assert = require('node:assert/strict');
const connectionPath = require.resolve('../../api/database/connection');
const schemaPath = require.resolve('../../api/database/ensure_org_workspace');
const tables = ['org_profile_design','org_positions','org_chart','org_invites','org_map_hub','org_units','org_access_groups','org_access_group_members'];
const readyMetadata = [
  ...tables.map(TABLE_NAME => ({TABLE_NAME, COLUMN_NAME:'org_id'})),
  ...['legal_name','tax_id','state_registration','address','city','state','postal_code','image_url'].map(COLUMN_NAME => ({TABLE_NAME:'org_units',COLUMN_NAME})),
  {TABLE_NAME:'organizations',COLUMN_NAME:'workspace_type'},
  {TABLE_NAME:'organizations',COLUMN_NAME:'logo_url',DATA_TYPE:'mediumtext'},
  {TABLE_NAME:'org_units',INDEX_NAME:'uq_org_unit_functional_location'}
];
function setup(metadata) {
  const previous = require.cache[connectionPath];
  const calls = [];
  require.cache[connectionPath] = {exports:{pool:{execute:async(sql,args)=>{
    calls.push({sql,args});
    if(sql.includes('UNION ALL')) return [metadata];
    return [[]];
  }}}};
  delete require.cache[schemaPath];
  const ensure = require(schemaPath);
  if(previous) require.cache[connectionPath] = previous; else delete require.cache[connectionPath];
  return {ensure,calls};
}
test('complete schema uses one metadata query and preserves the legacy name repair',async()=>{
  const {ensure,calls}=setup(readyMetadata);
  await ensure();
  assert.equal(calls.length,2);
  assert.match(calls[0].sql,/table_schema=DATABASE\(\)/);
  assert.match(calls[1].sql,/SELECT id, name FROM organizations/);
  assert.ok(!calls.some(call=>/CREATE|ALTER/.test(call.sql)));
});
test('missing schema retains the additive migration path',async()=>{
  const {ensure,calls}=setup([]);
  await ensure();
  assert.ok(calls.some(call=>call.sql.includes('CREATE TABLE IF NOT EXISTS org_map_hub')));
  assert.ok(calls.some(call=>call.sql.includes('ALTER TABLE org_units ADD COLUMN image_url')));
  assert.ok(!calls.some(call=>/DROP TABLE|DELETE FROM/.test(call.sql)));
});
