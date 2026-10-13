import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../models/material_item.dart';

class MaterialTile extends StatelessWidget {
  const MaterialTile({super.key, required this.item});

  final MaterialItem item;

  @override
  Widget build(BuildContext context) {
    final imageUrl = item.imageUrl;
    final hasImage = imageUrl != null && imageUrl.isNotEmpty;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border),
      ),
      child: ListTile(
        leading: hasImage
            ? CircleAvatar(
                backgroundColor: AppColors.purpleBg,
                backgroundImage: NetworkImage(imageUrl),
              )
            : const CircleAvatar(
                backgroundColor: AppColors.purpleBg,
                child: Icon(Icons.widgets, color: AppColors.purpleBtn),
              ),
        title: Text(
          item.description,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Text(
          'Cod: ${item.code}\nLocal: ${item.warehouse}',
          style: const TextStyle(fontSize: 12),
        ),
        trailing: Text(
          '${item.quantity}',
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: AppColors.purpleBtn,
          ),
        ),
      ),
    );
  }
}
