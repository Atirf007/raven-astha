import '../core/database/database_service.dart';
import '../models/movement_item.dart';

class MaterialNotFoundException implements Exception {
  const MaterialNotFoundException();

  @override
  String toString() => 'Material não encontrado!';
}

class MovementRepository {
  const MovementRepository(this._db);

  final DatabaseService _db;

  Future<List<MovementItem>> historyByOrg(String orgId, {int limit = 50}) {
    return _db.run((conn) async {
      final results = await conn.execute(
        'SELECT m.description, mov.type, mov.quantity, mov.created_at, u.name '
        'FROM movements mov '
        'JOIN materials m ON mov.material_id = m.id '
        'LEFT JOIN users u ON mov.created_by = u.id '
        'WHERE m.org_id = :orgId ORDER BY mov.created_at DESC LIMIT :limit',
        {'orgId': orgId, 'limit': limit},
      );
      return results.rows.map(MovementItem.fromRow).toList();
    });
  }

  /// Registra entrada/saída do material identificado por [code].
  /// Lança [MaterialNotFoundException] se o código não existir na organização.
  Future<void> register({
    required String code,
    required String orgId,
    required String userId,
    required MovementType type,
    required int quantity,
  }) {
    return _db.run((conn) async {
      final mats = await conn.execute(
        'SELECT id FROM materials WHERE code = :code AND org_id = :orgId',
        {'code': code, 'orgId': orgId},
      );
      if (mats.rows.isEmpty) throw const MaterialNotFoundException();

      final materialId = int.parse(mats.rows.first.colAt(0)!);
      final sign = type == MovementType.entrada ? '+' : '-';

      await conn.transactional((txn) async {
        await txn.execute(
          'UPDATE materials SET quantity = quantity $sign :qty WHERE id = :id',
          {'qty': quantity, 'id': materialId},
        );
        await txn.execute(
          'INSERT INTO movements (material_id, type, quantity, created_by) '
          'VALUES (:matId, :type, :qty, :uid)',
          {
            'matId': materialId,
            'type': type.name,
            'qty': quantity,
            'uid': int.parse(userId),
          },
        );
      });
    });
  }
}
