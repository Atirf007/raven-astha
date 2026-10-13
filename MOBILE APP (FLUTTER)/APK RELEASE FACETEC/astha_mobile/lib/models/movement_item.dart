import 'package:mysql_client/mysql_client.dart';

enum MovementType {
  entrada,
  saida;

  static MovementType fromString(String value) =>
      value == 'entrada' ? MovementType.entrada : MovementType.saida;
}

class MovementItem {
  const MovementItem({
    required this.description,
    required this.type,
    required this.quantity,
    required this.date,
    required this.userName,
  });

  final String description;
  final MovementType type;
  final int quantity;
  final String date;
  final String userName;

  bool get isEntrada => type == MovementType.entrada;

  /// Data sem os milissegundos.
  String get formattedDate => date.split('.').first;

  /// Espera as colunas: description, type, quantity, created_at, user name.
  factory MovementItem.fromRow(ResultSetRow row) => MovementItem(
        description: row.colAt(0) ?? '',
        type: MovementType.fromString(row.colAt(1) ?? ''),
        quantity: int.tryParse(row.colAt(2) ?? '0') ?? 0,
        date: row.colAt(3) ?? '',
        userName: row.colAt(4) ?? 'Desconhecido',
      );
}
