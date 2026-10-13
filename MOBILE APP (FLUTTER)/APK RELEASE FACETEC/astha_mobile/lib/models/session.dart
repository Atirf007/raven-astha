class Session {
  const Session({
    required this.userId,
    required this.orgId,
    required this.dbHost,
  });

  final String userId;
  final String orgId;
  final String dbHost;
}
