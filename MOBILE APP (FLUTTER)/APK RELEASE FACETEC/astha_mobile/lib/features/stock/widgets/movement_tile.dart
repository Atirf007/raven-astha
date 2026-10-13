import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../models/movement_item.dart';

class MovementTile extends StatelessWidget {
  const MovementTile({super.key, required this.item});

  final MovementItem item;

  @override
  Widget build(BuildContext context) {
    final color = item.isEntrada ? AppColors.success : AppColors.danger;
    final bg = item.isEntrada ? AppColors.successBg : AppColors.dangerBg;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border),
      ),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: bg,
          child: Icon(
            item.isEntrada ? Icons.arrow_downward : Icons.arrow_upward,
            color: color,
          ),
        ),
        title: Text(
          item.description,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          'Por: ${item.userName}\nEm: ${item.formattedDate}',
          style: const TextStyle(fontSize: 12),
        ),
        trailing: Text(
          '${item.isEntrada ? '+' : '-'}${item.quantity}',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
      ),
    );
  }
}
