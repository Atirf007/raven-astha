import 'package:flutter/material.dart';

import '../../core/database/database_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/async_list_view.dart';
import '../../models/material_item.dart';
import '../../models/movement_item.dart';
import '../../models/session.dart';
import '../../repositories/material_repository.dart';
import '../../repositories/movement_repository.dart';
import 'widgets/material_tile.dart';
import 'widgets/movement_tile.dart';

class StockTab extends StatelessWidget {
  StockTab({super.key, required this.session})
      : _materials = MaterialRepository(DatabaseService(session.dbHost)),
        _movements = MovementRepository(DatabaseService(session.dbHost));

  final Session session;
  final MaterialRepository _materials;
  final MovementRepository _movements;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Estoque e Histórico'),
          centerTitle: true,
          bottom: const TabBar(
            labelColor: AppColors.purpleBtn,
            unselectedLabelColor: AppColors.textMuted,
            indicatorColor: AppColors.purpleBtn,
            tabs: [
              Tab(text: 'Materiais'),
              Tab(text: 'Movimentações'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            AsyncListView<MaterialItem>(
              loader: () => _materials.listByOrg(session.orgId),
              emptyMessage: 'Nenhum material',
              itemBuilder: (_, item) => MaterialTile(item: item),
            ),
            AsyncListView<MovementItem>(
              loader: () => _movements.historyByOrg(session.orgId),
              emptyMessage: 'Nenhuma movimentação',
              itemBuilder: (_, item) => MovementTile(item: item),
            ),
          ],
        ),
      ),
    );
  }
}
