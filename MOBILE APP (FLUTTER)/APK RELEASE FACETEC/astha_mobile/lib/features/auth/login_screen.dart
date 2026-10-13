import 'package:flutter/material.dart';

import '../../core/database/database_service.dart';
import '../../core/storage/session_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../core/widgets/rounded_text_field.dart';
import '../../repositories/auth_repository.dart';
import '../dashboard/main_dashboard.dart';
import 'widgets/db_host_dialog.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.initialDbHost});

  final String initialDbHost;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _storage = const SessionStorage();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  late String _dbHost = widget.initialDbHost;
  bool _loading = false;
  bool _obscurePwd = true;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _configureHost() async {
    final result = await showDbHostDialog(context, _dbHost);
    if (result == null || result.isEmpty) return;
    setState(() => _dbHost = result);
    await _storage.saveDbHost(result);
  }

  Future<void> _login() async {
    final email = _emailCtrl.text.trim();
    final password = _passCtrl.text;
    if (email.isEmpty || password.isEmpty) {
      AppSnackBar.error(context, 'Preencha os dados.');
      return;
    }

    setState(() => _loading = true);
    try {
      final repo = AuthRepository(DatabaseService(_dbHost));
      final session = await repo.login(email: email, password: password);
      if (!mounted) return;

      if (session == null) {
        AppSnackBar.error(context, 'Email ou senha incorretos.');
        return;
      }

      await _storage.saveSession(session);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => MainDashboard(session: session)),
      );
    } catch (e) {
      AppSnackBar.error(context, 'Erro DB: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, color: AppColors.textMuted),
            onPressed: _configureHost,
          ),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0.2, -0.2),
            radius: 1.5,
            colors: [
              Color(0x668B5CF6),
              Color(0x33E3D5FF),
              AppColors.backgroundLight,
            ],
            stops: [0.0, 0.5, 1.0],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _buildCard(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [
          BoxShadow(
            color: Color(0x148B5CF6),
            blurRadius: 40,
            offset: Offset(0, 20),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Brand(),
          const SizedBox(height: 40),
          const Text(
            'Bem-vindo ao ASTHA',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: AppColors.textDark,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Faça login para acessar o sistema',
            style: TextStyle(fontSize: 15, color: AppColors.textMuted),
          ),
          const SizedBox(height: 32),
          RoundedTextField(
            controller: _emailCtrl,
            hint: 'E-mail',
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 20),
          RoundedTextField(
            controller: _passCtrl,
            hint: 'Senha',
            obscureText: _obscurePwd,
            suffixIcon: IconButton(
              icon: Icon(
                _obscurePwd
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
                color: AppColors.textMuted,
                size: 18,
              ),
              onPressed: () => setState(() => _obscurePwd = !_obscurePwd),
            ),
          ),
          const SizedBox(height: 30),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: _loading ? null : _login,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.purpleBtn,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Text(
                      'Entrar',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Brand extends StatelessWidget {
  const _Brand();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Image.asset(
          'assets/images/app_icon.png',
          height: 32,
          errorBuilder: (_, __, ___) => const Icon(Icons.error),
        ),
        const SizedBox(width: 12),
        const Text(
          'ASTHA RAVEN',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.textDark,
          ),
        ),
      ],
    );
  }
}
