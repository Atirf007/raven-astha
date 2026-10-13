import 'package:bcrypt/bcrypt.dart';

import '../core/database/database_service.dart';
import '../models/session.dart';

class AuthRepository {
  const AuthRepository(this._db);

  final DatabaseService _db;

  /// Retorna a [Session] se as credenciais forem válidas, ou `null` caso contrário.
  Future<Session?> login({
    required String email,
    required String password,
  }) {
    return _db.run((conn) async {
      final results = await conn.execute(
        'SELECT id, password_hash, org_id FROM users '
        'WHERE email = :email AND is_active = 1',
        {'email': email},
      );
      if (results.rows.isEmpty) return null;

      final row = results.rows.first;
      final hash = row.colAt(1);
      if (hash == null || !BCrypt.checkpw(password, hash)) return null;

      return Session(
        userId: row.colAt(0)!,
        orgId: row.colAt(2) ?? '1',
        dbHost: _db.host,
      );
    });
  }
}
