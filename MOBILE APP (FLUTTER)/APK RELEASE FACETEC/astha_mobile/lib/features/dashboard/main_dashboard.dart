import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/session.dart';
import '../profile/profile_tab.dart';
import '../scanner/scanner_screen.dart';
import '../stock/stock_tab.dart';

class MainDashboard extends StatefulWidget {
  const MainDashboard({super.key, required this.session});

  final Session session;

  @override
  State<MainDashboard> createState() => _MainDashboardState();
}

class _MainDashboardState extends State<MainDashboard> {
  int _currentIndex = 0;

  /// Muda a cada retorno do scanner para recarregar o estoque.
  int _stockVersion = 0;

  Future<void> _openScanner() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ScannerScreen(session: widget.session)),
    );
    if (mounted) setState(() => _stockVersion++);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _currentIndex == 0
          ? StockTab(
              key: ValueKey(_stockVersion),
              session: widget.session,
            )
          : ProfileTab(session: widget.session),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openScanner,
        backgroundColor: AppColors.purpleBtn,
        icon: const Icon(Icons.qr_code_scanner, color: Colors.white),
        label: const Text(
          'Escanear',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        selectedItemColor: AppColors.purpleBtn,
        unselectedItemColor: AppColors.textMuted,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.inventory_2_outlined),
            activeIcon: Icon(Icons.inventory_2),
            label: 'Estoque',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person),
            label: 'Perfil',
          ),
        ],
      ),
    );
  }
}
