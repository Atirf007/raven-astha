import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mysql_client/mysql_client.dart';
import 'package:bcrypt/bcrypt.dart';

void main() {
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
  ));
  runApp(const AsthaMobileApp());
}

class AppColors {
  static const Color purpleBg = Color(0xFFE3D5FF);
  static const Color purpleBtn = Color(0xFF8B5CF6);
  static const Color purpleBtnHover = Color(0xFF7C3AED);
  static const Color purpleDark = Color(0xFF4C1D95);
  static const Color textDark = Color(0xFF1E293B);
  static const Color textMuted = Color(0xFF64748B);
  static const Color border = Color(0xFFF1F5F9);
  static const Color backgroundLight = Color(0xFFFDFCFF);
}

class AsthaMobileApp extends StatelessWidget {
  const AsthaMobileApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'ASTHA RAVEN',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primaryColor: AppColors.purpleBtn,
        scaffoldBackgroundColor: AppColors.backgroundLight,
        fontFamily: 'Inter',
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          elevation: 0.5,
          iconTheme: IconThemeData(color: AppColors.textDark),
          titleTextStyle: TextStyle(color: AppColors.textDark, fontSize: 18, fontWeight: FontWeight.w600),
        ),
      ),
      home: const AuthWrapper(),
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});
  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  bool _isLoading = true;
  String? _userId;
  String? _orgId;
  String? _dbHost;
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }
  Future<void> _checkAuth() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _userId = prefs.getString('userId');
      _orgId = prefs.getString('orgId');
      _dbHost = prefs.getString('dbHost') ?? '143.106.241.4';
      _isLoading = false;
    });
  }
  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.purpleBtn)));
    if (_userId != null && _orgId != null && _dbHost != null) return MainDashboard(dbHost: _dbHost!, userId: _userId!, orgId: _orgId!);
    return LoginScreen(initialDbHost: _dbHost ?? '143.106.241.4');
  }
}

class LoginScreen extends StatefulWidget {
  final String initialDbHost;
  const LoginScreen({super.key, required this.initialDbHost});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  late String _dbHost;
  bool _loading = false;
  bool _obscurePwd = true;
  @override
  void initState() {
    super.initState();
    _dbHost = widget.initialDbHost;
  }
  Future<void> _showConfigDialog() async {
    final ctrl = TextEditingController(text: _dbHost);
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Configuração de Banco'),
        content: TextField(controller: ctrl, decoration: const InputDecoration(labelText: 'Endereço (IP)')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancelar')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.purpleBtn),
            child: const Text('Salvar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (result != null && result.isNotEmpty) {
      setState(() => _dbHost = result);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('dbHost', result);
    }
  }
  Future<void> _login() async {
    if (_emailCtrl.text.isEmpty || _passCtrl.text.isEmpty) {
      _showError('Preencha os dados.');
      return;
    }
    setState(() => _loading = true);
    MySQLConnection? conn;
    try {
      final connFuture = MySQLConnection.createConnection(host: _dbHost, port: 3306, userName: 'cl205131', password: 'cl*14072006', databaseName: 'cl205131');
      conn = await connFuture;
      await conn.connect();
      var results = await conn.execute('SELECT id, password_hash, org_id FROM users WHERE email = :email AND is_active = 1', {'email': _emailCtrl.text.trim()});
      if (results.rows.isEmpty) {
        _showError('Email ou senha incorretos.');
      } else {
        var row = results.rows.first;
        String hash = row.colAt(1)!;
        int userId = int.parse(row.colAt(0)!);
        int orgId = int.parse(row.colAt(2) ?? '1');
        if (BCrypt.checkpw(_passCtrl.text, hash)) {
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('userId', userId.toString());
          await prefs.setString('orgId', orgId.toString());
          await prefs.setString('dbHost', _dbHost);
          if (!mounted) return;
          Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => MainDashboard(dbHost: _dbHost, userId: userId.toString(), orgId: orgId.toString())));
        } else {
          _showError('Email ou senha incorretos.');
        }
      }
    } catch (e) {
      _showError('Erro DB: $e');
    } finally {
      await conn?.close();
      if (mounted) setState(() => _loading = false);
    }
  }
  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: Colors.redAccent, behavior: SnackBarBehavior.floating));
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0, actions: [IconButton(icon: const Icon(Icons.settings, color: AppColors.textMuted), onPressed: _showConfigDialog)]),
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(center: Alignment(0.2, -0.2), radius: 1.5, colors: [Color(0x668B5CF6), Color(0x33E3D5FF), AppColors.backgroundLight], stops: [0.0, 0.5, 1.0]),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              child: Container(
                width: double.infinity, padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), boxShadow: const [BoxShadow(color: Color(0x148B5CF6), blurRadius: 40, offset: Offset(0, 20))]),
                child: Column(
                  mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Image.asset('assets/images/app_icon.png', height: 32, errorBuilder: (c,e,s) => const Icon(Icons.error)),
                        const SizedBox(width: 12),
                        const Text('ASTHA RAVEN', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textDark)),
                      ],
                    ),
                    const SizedBox(height: 40),
                    const Text('Bem-vindo ao ASTHA', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: AppColors.textDark, letterSpacing: -0.5)),
                    const SizedBox(height: 8),
                    const Text('Faça login para acessar o sistema', style: TextStyle(fontSize: 15, color: AppColors.textMuted)),
                    const SizedBox(height: 32),
                    Container(
                      height: 48,
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border, width: 1.5)),
                      child: TextField(controller: _emailCtrl, decoration: const InputDecoration(hintText: 'E-mail', border: InputBorder.none, contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12)), style: const TextStyle(fontSize: 14)),
                    ),
                    const SizedBox(height: 20),
                    Container(
                      height: 48,
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.border, width: 1.5)),
                      child: TextField(controller: _passCtrl, obscureText: _obscurePwd, decoration: InputDecoration(hintText: 'Senha', border: InputBorder.none, contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12), suffixIcon: IconButton(icon: Icon(_obscurePwd ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: AppColors.textMuted, size: 18), onPressed: () => setState(() => _obscurePwd = !_obscurePwd))), style: const TextStyle(fontSize: 14)),
                    ),
                    const SizedBox(height: 30),
                    SizedBox(
                      width: double.infinity, height: 48,
                      child: ElevatedButton(
                        onPressed: _loading ? null : _login,
                        style: ElevatedButton.styleFrom(backgroundColor: AppColors.purpleBtn, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                        child: _loading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('Entrar', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class MainDashboard extends StatefulWidget {
  final String dbHost;
  final String userId;
  final String orgId;
  const MainDashboard({super.key, required this.dbHost, required this.userId, required this.orgId});
  @override
  State<MainDashboard> createState() => _MainDashboardState();
}

class _MainDashboardState extends State<MainDashboard> {
  int _currentIndex = 0;
  void _onTabTapped(int index) { setState(() => _currentIndex = index); }
  void _openScanner() {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => ScannerScreen(dbHost: widget.dbHost, userId: widget.userId, orgId: widget.orgId))).then((_) => setState(() {}));
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _currentIndex == 0 ? StockTab(dbHost: widget.dbHost, orgId: widget.orgId) : ProfileTab(dbHost: widget.dbHost, userId: widget.userId),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openScanner,
        backgroundColor: AppColors.purpleBtn,
        icon: const Icon(Icons.qr_code_scanner, color: Colors.white),
        label: const Text('Escanear', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: _onTabTapped,
        selectedItemColor: AppColors.purpleBtn,
        unselectedItemColor: AppColors.textMuted,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.inventory_2_outlined), activeIcon: Icon(Icons.inventory_2), label: 'Estoque'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Perfil'),
        ],
      ),
    );
  }
}

class StockTab extends StatefulWidget {
  final String dbHost;
  final String orgId;
  const StockTab({super.key, required this.dbHost, required this.orgId});
  @override
  State<StockTab> createState() => _StockTabState();
}

class _StockTabState extends State<StockTab> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  Future<List<Map<String, dynamic>>> _fetchMaterials() async {
    final conn = await MySQLConnection.createConnection(host: widget.dbHost, port: 3306, userName: 'cl205131', password: 'cl*14072006', databaseName: 'cl205131');
    await conn.connect();
    var results = await conn.execute('SELECT m.code, m.description, m.quantity, w.name, m.image_url FROM materials m LEFT JOIN warehouses w ON m.warehouse_id = w.id WHERE m.org_id = :orgId ORDER BY m.description ASC', {'orgId': widget.orgId});
    await conn.close();
    return results.rows.map((row) => {
      'code': row.colAt(0) ?? '',
      'description': row.colAt(1) ?? '',
      'quantity': int.tryParse(row.colAt(2) ?? '0') ?? 0,
      'warehouse': row.colAt(3) ?? 'Armazém Geral',
    }).toList();
  }

  Future<List<Map<String, dynamic>>> _fetchHistory() async {
    final conn = await MySQLConnection.createConnection(host: widget.dbHost, port: 3306, userName: 'cl205131', password: 'cl*14072006', databaseName: 'cl205131');
    await conn.connect();
    var results = await conn.execute('SELECT m.description, mov.type, mov.quantity, mov.created_at, u.name FROM movements mov JOIN materials m ON mov.material_id = m.id LEFT JOIN users u ON mov.created_by = u.id WHERE m.org_id = :orgId ORDER BY mov.created_at DESC LIMIT 50', {'orgId': widget.orgId});
    await conn.close();
    return results.rows.map((row) => {
      'description': row.colAt(0) ?? '',
      'type': row.colAt(1) ?? '',
      'quantity': int.tryParse(row.colAt(2) ?? '0') ?? 0,
      'date': row.colAt(3) ?? '',
      'user': row.colAt(4) ?? 'Desconhecido',
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Estoque e Histórico'),
        centerTitle: true,
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.purpleBtn,
          unselectedLabelColor: AppColors.textMuted,
          indicatorColor: AppColors.purpleBtn,
          tabs: const [
            Tab(text: 'Materiais'),
            Tab(text: 'Movimentações'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // TAB 1 - MATERIAIS
          FutureBuilder<List<Map<String, dynamic>>>(
            future: _fetchMaterials(),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
              if (snapshot.hasError) return Center(child: Text('Erro DB: ${snapshot.error}'));
              final items = snapshot.data ?? [];
              if (items.isEmpty) return const Center(child: Text('Nenhum material'));
              return RefreshIndicator(
                onRefresh: () async => setState(() {}),
                child: ListView.builder(
                  padding: const EdgeInsets.only(top: 12, bottom: 80, left: 16, right: 16),
                  itemCount: items.length,
                  itemBuilder: (context, index) {
                    final item = items[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: AppColors.border)),
                      elevation: 0,
                      child: ListTile(
                        leading: item['image_url'] != null && item['image_url'].isNotEmpty ? CircleAvatar(backgroundColor: AppColors.purpleBg, backgroundImage: NetworkImage(item['image_url'])) : const CircleAvatar(backgroundColor: AppColors.purpleBg, child: Icon(Icons.widgets, color: AppColors.purpleBtn)),
                        title: Text(item['description'], style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text("Cod: ${item['code']}\nLocal: ${item['warehouse']}", style: const TextStyle(fontSize: 12)),
                        trailing: Text("${item['quantity']}", style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.purpleBtn)),
                      ),
                    );
                  },
                ),
              );
            },
          ),
          // TAB 2 - HISTÓRICO
          FutureBuilder<List<Map<String, dynamic>>>(
            future: _fetchHistory(),
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
              if (snapshot.hasError) return Center(child: Text('Erro DB: ${snapshot.error}'));
              final items = snapshot.data ?? [];
              if (items.isEmpty) return const Center(child: Text('Nenhuma movimentação'));
              return RefreshIndicator(
                onRefresh: () async => setState(() {}),
                child: ListView.builder(
                  padding: const EdgeInsets.only(top: 12, bottom: 80, left: 16, right: 16),
                  itemCount: items.length,
                  itemBuilder: (context, index) {
                    final item = items[index];
                    final isEntrada = item['type'] == 'entrada';
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: AppColors.border)),
                      elevation: 0,
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: isEntrada ? const Color(0xFFD1FAE5) : const Color(0xFFFEE2E2),
                          child: Icon(isEntrada ? Icons.arrow_downward : Icons.arrow_upward, color: isEntrada ? const Color(0xFF10B981) : const Color(0xFFEF4444)),
                        ),
                        title: Text(item['description'], style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text("Por: ${item['user']}\nEm: ${item['date'].toString().split('.')[0]}", style: const TextStyle(fontSize: 12)),
                        trailing: Text("${isEntrada ? '+' : '-'}${item['quantity']}", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isEntrada ? const Color(0xFF10B981) : const Color(0xFFEF4444))),
                      ),
                    );
                  },
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class ProfileTab extends StatefulWidget {
  final String dbHost;
  final String userId;
  const ProfileTab({super.key, required this.dbHost, required this.userId});
  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  bool _loading = true;
  final _nameCtrl = TextEditingController();
  final _surnameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _dobCtrl = TextEditingController();
  final _genderCtrl = TextEditingController();
  final _countryCtrl = TextEditingController();
  
  String _email = '';
  String _company = '';
  String _role = '';
  String _sector = '';

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final conn = await MySQLConnection.createConnection(host: widget.dbHost, port: 3306, userName: 'cl205131', password: 'cl*14072006', databaseName: 'cl205131');
      await conn.connect();
      var results = await conn.execute('SELECT name, surname, email, phone, company, role, sector, dob, gender, country FROM users WHERE id = :id', {'id': widget.userId});
      await conn.close();
      if (results.rows.isNotEmpty) {
        var row = results.rows.first;
        setState(() {
          _nameCtrl.text = row.colAt(0) ?? '';
          _surnameCtrl.text = row.colAt(1) ?? '';
          _email = row.colAt(2) ?? '';
          _phoneCtrl.text = row.colAt(3) ?? '';
          _company = row.colAt(4) ?? '';
          _role = row.colAt(5) ?? '';
          _sector = row.colAt(6) ?? '';
          _dobCtrl.text = row.colAt(7) ?? '';
          _genderCtrl.text = row.colAt(8) ?? '';
          _countryCtrl.text = row.colAt(9) ?? '';
        });
      }
    } catch (e) {
      debugPrint('Error: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _saveProfile() async {
    setState(() => _loading = true);
    try {
      final conn = await MySQLConnection.createConnection(host: widget.dbHost, port: 3306, userName: 'cl205131', password: 'cl*14072006', databaseName: 'cl205131');
      await conn.connect();
      await conn.execute(
        'UPDATE users SET name = :name, surname = :surname, phone = :phone, dob = :dob, gender = :gender, country = :country WHERE id = :id',
        {
          'name': _nameCtrl.text,
          'surname': _surnameCtrl.text,
          'phone': _phoneCtrl.text,
          'dob': _dobCtrl.text,
          'gender': _genderCtrl.text,
          'country': _countryCtrl.text,
          'id': widget.userId
        }
      );
      await conn.close();
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Perfil atualizado com sucesso!'), backgroundColor: Color(0xFF10B981)));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erro: $e'), backgroundColor: Colors.redAccent));
    } finally {
      setState(() => _loading = false);
    }
  }

  Widget _buildField(String label, TextEditingController ctrl) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextField(
        controller: ctrl,
        decoration: InputDecoration(
          labelText: label,
          filled: true, fillColor: Colors.white,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.border)),
        ),
      ),
    );
  }

  Widget _buildReadOnly(String label, String val) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextField(
        controller: TextEditingController(text: val),
        readOnly: true,
        decoration: InputDecoration(
          labelText: label,
          filled: true, fillColor: const Color(0xFFF8FAFC),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
        ),
        style: const TextStyle(color: AppColors.textMuted),
      ),
    );
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('userId');
    if (!mounted) return;
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => LoginScreen(initialDbHost: widget.dbHost)));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.purpleBtn)));
    return Scaffold(
      appBar: AppBar(title: const Text('Meu Perfil'), centerTitle: true, actions: [IconButton(icon: const Icon(Icons.logout), onPressed: _logout)]),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(left: 24, right: 24, top: 24, bottom: 80),
        child: Column(
          children: [
            const CircleAvatar(radius: 40, backgroundColor: AppColors.purpleBg, child: Icon(Icons.person, size: 40, color: AppColors.purpleBtn)),
            const SizedBox(height: 16),
            Text(_email, style: const TextStyle(color: AppColors.textMuted, fontSize: 14)),
            const SizedBox(height: 32),
            
            _buildField('Nome', _nameCtrl),
            _buildField('Sobrenome', _surnameCtrl),
            _buildField('Telefone', _phoneCtrl),
            _buildField('Data de Nascimento', _dobCtrl),
            _buildField('Gênero', _genderCtrl),
            _buildField('País', _countryCtrl),
            
            const Divider(height: 32),
            
            _buildReadOnly('Empresa', _company),
            _buildReadOnly('Setor', _sector),
            _buildReadOnly('Função / Role', _role),

            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity, height: 48,
              child: ElevatedButton(
                onPressed: _saveProfile,
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.purpleBtn, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                child: const Text('SALVAR ALTERAÇÕES', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            )
          ],
        ),
      ),
    );
  }
}

class ScannerScreen extends StatefulWidget {
  final String dbHost;
  final String userId;
  final String orgId;
  const ScannerScreen({super.key, required this.dbHost, required this.userId, required this.orgId});
  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final LocalAuthentication _auth = LocalAuthentication();
  bool _isProcessing = false;
  final MobileScannerController _cameraController = MobileScannerController();

  void _handleBarcode(BarcodeCapture capture) {
    if (_isProcessing) return;
    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isNotEmpty && barcodes.first.rawValue != null) _processItem(barcodes.first.rawValue!);
  }

  Future<void> _processItem(String code) async {
    setState(() => _isProcessing = true);
    final action = await showDialog<String>(
      context: context, barrierDismissible: false,
      builder: (context) {
        int qty = 1;
        return StatefulBuilder(
          builder: (context, setStateDialog) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              title: Text('Material: $code', style: const TextStyle(fontWeight: FontWeight.w700)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Quantidade:', style: TextStyle(color: AppColors.textMuted)),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(icon: const Icon(Icons.remove_circle_outline), onPressed: () { if (qty > 1) setStateDialog(() => qty--); }),
                      Container(padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8), decoration: BoxDecoration(color: AppColors.border, borderRadius: BorderRadius.circular(12)), child: Text('$qty', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold))),
                      IconButton(icon: const Icon(Icons.add_circle_outline), onPressed: () => setStateDialog(() => qty++)),
                    ],
                  )
                ],
              ),
              actionsAlignment: MainAxisAlignment.spaceEvenly,
              actions: [
                TextButton(onPressed: () => Navigator.of(context).pop('cancel'), child: const Text('CANCELAR')),
                ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)), onPressed: () => Navigator.of(context).pop('entrada:$qty'), child: const Text('ENTRADA', style: TextStyle(color: Colors.white))),
                ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)), onPressed: () => Navigator.of(context).pop('saida:$qty'), child: const Text('SAÍDA', style: TextStyle(color: Colors.white))),
              ],
            );
          }
        );
      }
    );

    if (action == null || action == 'cancel') {
      setState(() => _isProcessing = false);
      return;
    }

    try {
      if (await _auth.canCheckBiometrics || await _auth.isDeviceSupported()) {
        bool didAuthenticate = await _auth.authenticate(localizedReason: 'Confirme sua identidade.');
        if (!didAuthenticate) {
          _showToast('Cancelado', true);
          setState(() => _isProcessing = false);
          return;
        }
      }

      final parts = action.split(':');
      final type = parts[0]; 
      final qty = int.parse(parts[1]);
      _showToast('Registrando...', false);

      final connFuture = MySQLConnection.createConnection(host: widget.dbHost, port: 3306, userName: 'cl205131', password: 'cl*14072006', databaseName: 'cl205131');
      final conn = await connFuture;
      await conn.connect();
      
      try {
        var mats = await conn.execute('SELECT id FROM materials WHERE code = :code AND org_id = :orgId', {'code': code, 'orgId': widget.orgId});
        if (mats.rows.isEmpty) {
          _showToast('Material não encontrado!', true);
          setState(() => _isProcessing = false);
        } else {
          int matId = int.parse(mats.rows.first.colAt(0)!);
          await conn.transactional((txn) async {
             if (type == 'entrada') {
               await txn.execute('UPDATE materials SET quantity = quantity + :qty WHERE id = :id', {'qty': qty, 'id': matId});
             } else {
               await txn.execute('UPDATE materials SET quantity = quantity - :qty WHERE id = :id', {'qty': qty, 'id': matId});
             }
             await txn.execute('INSERT INTO movements (material_id, type, quantity, created_by) VALUES (:matId, :type, :qty, :uid)', {'matId': matId, 'type': type, 'qty': qty, 'uid': int.parse(widget.userId)});
          });
          _showToast('Movimentação registrada com sucesso!', false);
          Future.delayed(const Duration(milliseconds: 500), () {
            if (mounted) Navigator.of(context).pop();
          });
        }
      } finally {
        await conn.close();
      }
    } catch (e) {
      _showToast('Erro: $e', true);
      setState(() => _isProcessing = false);
    }
  }

  void _showToast(String msg, bool isError) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: isError ? const Color(0xFFEF4444) : const Color(0xFF10B981)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Escanear QR Code'), leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.of(context).pop())),
      body: Stack(
        children: [
          MobileScanner(controller: _cameraController, onDetect: _handleBarcode),
          if (_isProcessing) Container(color: Colors.white.withOpacity(0.8), child: const Center(child: CircularProgressIndicator(color: AppColors.purpleBtn))),
        ],
      ),
    );
  }
}
