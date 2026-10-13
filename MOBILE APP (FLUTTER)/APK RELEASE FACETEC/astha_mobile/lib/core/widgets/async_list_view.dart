import 'package:flutter/material.dart';

/// Lista assíncrona com loading, erro, estado vazio e pull-to-refresh.
class AsyncListView<T> extends StatefulWidget {
  const AsyncListView({
    super.key,
    required this.loader,
    required this.itemBuilder,
    required this.emptyMessage,
  });

  final Future<List<T>> Function() loader;
  final Widget Function(BuildContext context, T item) itemBuilder;
  final String emptyMessage;

  @override
  State<AsyncListView<T>> createState() => _AsyncListViewState<T>();
}

class _AsyncListViewState<T> extends State<AsyncListView<T>> {
  late Future<List<T>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.loader();
  }

  Future<void> _refresh() async {
    final next = widget.loader();
    setState(() => _future = next);
    await next.catchError((_) => <T>[]);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<T>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(child: Text('Erro DB: ${snapshot.error}'));
        }
        final items = snapshot.data ?? [];
        if (items.isEmpty) return Center(child: Text(widget.emptyMessage));
        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView.builder(
            padding: const EdgeInsets.only(
                top: 12, bottom: 80, left: 16, right: 16),
            itemCount: items.length,
            itemBuilder: (context, i) => widget.itemBuilder(context, items[i]),
          ),
        );
      },
    );
  }
}
