import '../core/database/database_service.dart';
import '../models/material_item.dart';

class MaterialRepository {
  const MaterialRepository(this._db);

  final DatabaseService _db;

  Future<List<MaterialItem>> listByOrg(String orgId) {
    return _db.run((conn) async {
      final results = await conn.execute(
        'SELECT m.code, m.description, m.quantity, w.name, m.image_url '
        'FROM materials m '
        'LEFT JOIN warehouses w ON m.warehouse_id = w.id '
        'WHERE m.org_id = :orgId ORDER BY m.description ASC',
        {'orgId': orgId},
      );
      return results.rows.map(MaterialItem.fromRow).toList();
    });
  }
}
