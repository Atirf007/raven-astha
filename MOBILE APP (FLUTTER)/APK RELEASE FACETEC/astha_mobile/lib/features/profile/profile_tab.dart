import 'package:flutter/material.dart';

import '../../core/database/database_service.dart';
import '../../core/storage/session_storage.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_snackbar.dart';
import '../../models/session.dart';
import '../../models/user_profile.dart';
import '../../repositories/profile_repository.dart';
import '../auth/login_screen.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key, required this.session});

  final Session session;

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  late final ProfileRepository _repo =
      ProfileRepository(DatabaseService(widget.session.dbHost));

  final _nameCtrl = TextEditingController();
  final _surnameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _dobCtrl = TextEditingController();
  final _genderCtrl = TextEditingController();
  final _countryCtrl = TextEditingController();

  bool _loading = true;
  UserProfile? _profile;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in [
      _nameCtrl,
      _surnameCtrl,
      _phoneCtrl,
      _dobCtrl,
      _genderCtrl,
      _countryCtrl,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final profile = await _repo.fetch(widget.session.userId);
      if (!mounted || profile == null) return;
      setState(() {
        _profile = profile;
        _nameCtrl.text = profile.name;
        _surnameCtrl.text = profile.surname;
        _phoneCtrl.text = profile.phone;
        _dobCtrl.text = profile.dob;
        _genderCtrl.text = profile.gender;
        _countryCtrl.text = profile.country;
      });
    } catch (e) {
      debugPrint('Erro ao carregar perfil: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    setState(() => _loading = true);
    try {
      await _repo.update(
        widget.session.userId,
        EditableProfile(
          name: _nameCtrl.text,
          surname: _surnameCtrl.text,
          phone: _phoneCtrl.text,
          dob: _dobCtrl.text,
          gender: _genderCtrl.text,
          country: _countryCtrl.text,
        ),
      );
      if (mounted) AppSnackBar.success(context, 'Perfil atualizado com sucesso!');
    } catch (e) {
      if (mounted) AppSnackBar.error(context, 'Erro: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _logout() async {
    await const SessionStorage().clearSession();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => LoginScreen(initialDbHost: widget.session.dbHost),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: AppColors.purpleBtn),
        ),
      );
    }

    final profile = _profile;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Meu Perfil'),
        centerTitle: true,
        actions: [
          IconButton(icon: const Icon(Icons.logout), onPressed: _logout),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 80),
        child: Column(
          children: [
            const CircleAvatar(
              radius: 40,
              backgroundColor: AppColors.purpleBg,
              child: Icon(Icons.person, size: 40, color: AppColors.purpleBtn),
            ),
            const SizedBox(height: 16),
            Text(
              profile?.email ?? '',
              style: const TextStyle(color: AppColors.textMuted, fontSize: 14),
            ),
            const SizedBox(height: 32),
            _EditableField(label: 'Nome', controller: _nameCtrl),
            _EditableField(label: 'Sobrenome', controller: _surnameCtrl),
            _EditableField(label: 'Telefone', controller: _phoneCtrl),
            _EditableField(label: 'Data de Nascimento', controller: _dobCtrl),
            _EditableField(label: 'Gênero', controller: _genderCtrl),
            _EditableField(label: 'País', controller: _countryCtrl),
            const Divider(height: 32),
            _ReadOnlyField(label: 'Empresa', value: profile?.company ?? ''),
            _ReadOnlyField(label: 'Setor', value: profile?.sector ?? ''),
            _ReadOnlyField(label: 'Função / Role', value: profile?.role ?? ''),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.purpleBtn,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'SALVAR ALTERAÇÕES',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EditableField extends StatelessWidget {
  const _EditableField({required this.label, required this.controller});

  final String label;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextField(
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.border),
          ),
        ),
      ),
    );
  }
}

class _ReadOnlyField extends StatelessWidget {
  const _ReadOnlyField({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        key: ValueKey(value),
        initialValue: value,
        readOnly: true,
        style: const TextStyle(color: AppColors.textMuted),
        decoration: InputDecoration(
          labelText: label,
          filled: true,
          fillColor: AppColors.readOnlyBg,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    );
  }
}
