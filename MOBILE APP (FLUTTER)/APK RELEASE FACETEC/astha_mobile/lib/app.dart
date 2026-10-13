import 'package:flutter/material.dart';

import 'core/theme/app_theme.dart';
import 'features/auth/auth_wrapper.dart';

class AsthaMobileApp extends StatelessWidget {
  const AsthaMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ASTHA RAVEN',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: const AuthWrapper(),
    );
  }
}
