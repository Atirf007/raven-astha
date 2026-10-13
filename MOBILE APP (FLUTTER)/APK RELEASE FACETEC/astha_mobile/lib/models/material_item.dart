import 'package:mysql_client/mysql_client.dart';

class MaterialItem {
  const MaterialItem({
    required this.code,
    required this.description,
    required this.quantity,
    required this.warehouse,
    this.imageUrl,
  });

  final String code;
  final String description;
  final int quantity;
  final String warehouse;
  final String? imageUrl;

  /// Espera as colunas: code, description, quantity, warehouse name, image_url.
  factory MaterialItem.fromRow(ResultSetRow row) => MaterialItem(
        code: row.colAt(0) ?? '',
        description: row.colAt(1) ?? '',
        quantity: int.tryParse(row.colAt(2) ?? '0') ?? 0,
        warehouse: row.colAt(3) ?? 'Armazém Geral',
        imageUrl: row.colAt(4),
      );
}
