import '../core/database/database_service.dart';
import '../models/user_profile.dart';

class ProfileRepository {
  const ProfileRepository(this._db);

  final DatabaseService _db;

  Future<UserProfile?> fetch(String userId) {
    return _db.run((conn) async {
      final results = await conn.execute(
        'SELECT name, surname, email, phone, company, role, sector, '
        'dob, gender, country FROM users WHERE id = :id',
        {'id': userId},
      );
      if (results.rows.isEmpty) return null;
      return UserProfile.fromRow(results.rows.first);
    });
  }

  Future<void> update(String userId, EditableProfile data) {
    return _db.run((conn) async {
      await conn.execute(
        'UPDATE users SET name = :name, surname = :surname, phone = :phone, '
        'dob = :dob, gender = :gender, country = :country WHERE id = :id',
        {
          'name': data.name,
          'surname': data.surname,
          'phone': data.phone,
          'dob': data.dob,
          'gender': data.gender,
          'country': data.country,
          'id': userId,
        },
      );
    });
  }
}
