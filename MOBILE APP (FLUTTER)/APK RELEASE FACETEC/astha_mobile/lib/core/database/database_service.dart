import 'package:mysql_client/mysql_client.dart';

import '../config/app_config.dart';

/// Abre e fecha a conexão por operação, garantindo o `close()` mesmo em erro.
class DatabaseService {
  const DatabaseService(this.host);

  final String host;

  Future<T> run<T>(Future<T> Function(MySQLConnection conn) action) async {
    final conn = await MySQLConnection.createConnection(
      host: host,
      port: AppConfig.dbPort,
      userName: AppConfig.dbUser,
      password: AppConfig.dbPassword,
      databaseName: AppConfig.dbName,
    );
    await conn.connect();
    try {
      return await action(conn);
    } finally {
      await conn.close();
    }
  }
}
