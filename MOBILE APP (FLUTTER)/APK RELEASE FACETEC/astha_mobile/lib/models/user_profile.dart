import 'package:mysql_client/mysql_client.dart';

class UserProfile {
  const UserProfile({
    required this.name,
    required this.surname,
    required this.email,
    required this.phone,
    required this.company,
    required this.role,
    required this.sector,
    required this.dob,
    required this.gender,
    required this.country,
  });

  final String name;
  final String surname;
  final String email;
  final String phone;
  final String company;
  final String role;
  final String sector;
  final String dob;
  final String gender;
  final String country;

  factory UserProfile.fromRow(ResultSetRow row) => UserProfile(
        name: row.colAt(0) ?? '',
        surname: row.colAt(1) ?? '',
        email: row.colAt(2) ?? '',
        phone: row.colAt(3) ?? '',
        company: row.colAt(4) ?? '',
        role: row.colAt(5) ?? '',
        sector: row.colAt(6) ?? '',
        dob: row.colAt(7) ?? '',
        gender: row.colAt(8) ?? '',
        country: row.colAt(9) ?? '',
      );
}

/// Campos que o usuário pode editar no perfil.
class EditableProfile {
  const EditableProfile({
    required this.name,
    required this.surname,
    required this.phone,
    required this.dob,
    required this.gender,
    required this.country,
  });

  final String name;
  final String surname;
  final String phone;
  final String dob;
  final String gender;
  final String country;
}
