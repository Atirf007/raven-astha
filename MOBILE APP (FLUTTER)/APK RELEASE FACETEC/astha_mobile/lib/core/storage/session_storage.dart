import 'package:shared_preferences/shared_preferences.dart';

import '../../models/session.dart';
import '../config/app_config.dart';

class SessionStorage {
  const SessionStorage();

  static const _kUserId = 'userId';
  static const _kOrgId = 'orgId';
  static const _kDbHost = 'dbHost';

  Future<String> loadDbHost() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_kDbHost) ?? AppConfig.defaultDbHost;
  }

  Future<void> saveDbHost(String host) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kDbHost, host);
  }

  Future<Session?> loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getString(_kUserId);
    final orgId = prefs.getString(_kOrgId);
    if (userId == null || orgId == null) return null;
    return Session(
      userId: userId,
      orgId: orgId,
      dbHost: prefs.getString(_kDbHost) ?? AppConfig.defaultDbHost,
    );
  }

  Future<void> saveSession(Session session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kUserId, session.userId);
    await prefs.setString(_kOrgId, session.orgId);
    await prefs.setString(_kDbHost, session.dbHost);
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kUserId);
    await prefs.remove(_kOrgId);
  }
}
