import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/database/database_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../models/session.dart';
import '../../repositories/movement_repository.dart';
import 'widgets/quantity_dialog.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key, required this.session});

  final Session session;

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final _auth = LocalAuthentication();
  final _camera = MobileScannerController();
  late final MovementRepository _movements =
      MovementRepository(DatabaseService(widget.session.dbHost));

  bool _isProcessing = false;

  @override
  void dispose() {
    _camera.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_isProcessing) return;
    final code = capture.barcodes.firstOrNull?.rawValue;
    if (code != null) _processItem(code);
  }

  Future<bool> _confirmIdentity() async {
    final canAuth =
        await _auth.canCheckBiometrics || await _auth.isDeviceSupported();
    if (!canAuth) return true;
    return _auth.authenticate(localizedReason: 'Confirme sua identidade.');
  }

  Future<void> _processItem(String code) async {
    setState(() => _isProcessing = true);
    try {
      final action = await showQuantityDialog(context, code);
      if (action == null) return;

      if (!await _confirmIdentity()) {
        if (mounted) AppSnackBar.error(context, 'Cancelado');
        return;
      }

      if (mounted) AppSnackBar.success(context, 'Registrando...');
      await _movements.register(
        code: code,
        orgId: widget.session.orgId,
        userId: widget.session.userId,
        type: action.type,
        quantity: action.quantity,
      );

      if (!mounted) return;
      AppSnackBar.success(context, 'Movimentação registrada com sucesso!');
      await Future<void>.delayed(const Duration(milliseconds: 500));
      if (mounted) Navigator.of(context).pop();
    } on MaterialNotFoundException catch (e) {
      if (mounted) AppSnackBar.error(context, e.toString());
    } catch (e) {
      if (mounted) AppSnackBar.error(context, 'Erro: $e');
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Escanear QR Code'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Stack(
        children: [
          MobileScanner(controller: _camera, onDetect: _onDetect),
          if (_isProcessing)
            Container(
              color: AppColors.overlay,
              child: const Center(
                child: CircularProgressIndicator(color: AppColors.purpleBtn),
              ),
            ),
        ],
      ),
    );
  }
}
