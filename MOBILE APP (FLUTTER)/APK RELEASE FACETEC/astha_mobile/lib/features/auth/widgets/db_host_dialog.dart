import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';

/// Pergunta o endereço do servidor. Retorna `null` se cancelado.
Future<String?> showDbHostDialog(BuildContext context, String current) {
  final ctrl = TextEditingController(text: current);
  return showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Configuração de Banco'),
      content: TextField(
        controller: ctrl,
        decoration: const InputDecoration(labelText: 'Endereço (IP)'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Cancelar'),
        ),
        ElevatedButton(
          onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
          style: ElevatedButton.styleFrom(backgroundColor: AppColors.purpleBtn),
          child: const Text('Salvar', style: TextStyle(color: Colors.white)),
        ),
      ],
    ),
  ).whenComplete(ctrl.dispose);
}
