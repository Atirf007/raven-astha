import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../models/movement_item.dart';

/// Resultado da escolha do usuário no diálogo.
class ScanAction {
  const ScanAction(this.type, this.quantity);

  final MovementType type;
  final int quantity;
}

/// Retorna `null` se o usuário cancelar.
Future<ScanAction?> showQuantityDialog(BuildContext context, String code) {
  return showDialog<ScanAction>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _QuantityDialog(code: code),
  );
}

class _QuantityDialog extends StatefulWidget {
  const _QuantityDialog({required this.code});

  final String code;

  @override
  State<_QuantityDialog> createState() => _QuantityDialogState();
}

class _QuantityDialogState extends State<_QuantityDialog> {
  int _qty = 1;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: Text(
        'Material: ${widget.code}',
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Quantidade:', style: TextStyle(color: AppColors.textMuted)),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.remove_circle_outline),
                onPressed: () {
                  if (_qty > 1) setState(() => _qty--);
                },
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '$_qty',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.add_circle_outline),
                onPressed: () => setState(() => _qty++),
              ),
            ],
          ),
        ],
      ),
      actionsAlignment: MainAxisAlignment.spaceEvenly,
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('CANCELAR'),
        ),
        _ActionButton(
          label: 'ENTRADA',
          color: AppColors.success,
          onPressed: () =>
              Navigator.of(context).pop(ScanAction(MovementType.entrada, _qty)),
        ),
        _ActionButton(
          label: 'SAÍDA',
          color: AppColors.danger,
          onPressed: () =>
              Navigator.of(context).pop(ScanAction(MovementType.saida, _qty)),
        ),
      ],
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.color,
    required this.onPressed,
  });

  final String label;
  final Color color;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      style: ElevatedButton.styleFrom(backgroundColor: color),
      onPressed: onPressed,
      child: Text(label, style: const TextStyle(color: Colors.white)),
    );
  }
}
