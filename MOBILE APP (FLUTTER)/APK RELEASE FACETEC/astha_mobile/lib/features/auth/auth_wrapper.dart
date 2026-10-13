import 'package:flutter/material.dart';

import '../../core/storage/session_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../models/session.dart';
import '../dashboard/main_dashboard.dart';
import 'login_screen.dart';

/// Decide entre login e dashboard conforme a sessão salva.
class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  final _storage = const SessionStorage();
  late final Future<(Session?, String)> _future = _load();

  Future<(Session?, String)> _load() async {
    final session = await _storage.loadSession();
    final host = session?.dbHost ?? await _storage.loadDbHost();
    return (session, host);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<(Session?, String)>(
      future: _future,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Scaffold(
            body: Center(
              child: CircularProgressIndicator(color: AppColors.purpleBtn),
            ),
          );
        }
        final (session, host) = snapshot.data!;
        if (session != null) return MainDashboard(session: session);
        return LoginScreen(initialDbHost: host);
      },
    );
  }
}
