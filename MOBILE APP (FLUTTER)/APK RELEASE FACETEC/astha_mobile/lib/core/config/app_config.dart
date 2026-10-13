/// Configuração injetada em tempo de build, nunca versionada.
///
/// flutter run \
///   --dart-define=DB_HOST=... --dart-define=DB_USER=... \
///   --dart-define=DB_PASSWORD=... --dart-define=DB_NAME=...
class AppConfig {
  AppConfig._();

  static const String defaultDbHost = String.fromEnvironment('DB_HOST');
  static const int dbPort = int.fromEnvironment('DB_PORT', defaultValue: 3306);
  static const String dbUser = String.fromEnvironment('DB_USER');
  static const String dbPassword = String.fromEnvironment('DB_PASSWORD');
  static const String dbName = String.fromEnvironment('DB_NAME');
}
