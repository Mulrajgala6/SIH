import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/app_state.dart';
import '../widgets/primary_button.dart';
import 'routes_screen.dart';

class _DemoAgent {
  final String region;
  final String name;
  final String email;
  final String poCode;

  const _DemoAgent({
    required this.region,
    required this.name,
    required this.email,
    required this.poCode,
  });
}

const _kDemoAgents = [
  _DemoAgent(region: 'Nashik City HO', name: 'Ramesh Gaikwad', email: 'postman1@daksync.in', poCode: 'NSK-HO'),
  _DemoAgent(region: 'Nashik Road', name: 'Dinesh More', email: 'postman4@daksync.in', poCode: 'NSK-RD'),
  _DemoAgent(region: 'Mumbai GPO', name: 'Vikram Shinde', email: 'postman6@daksync.in', poCode: 'BOM-GPO'),
  _DemoAgent(region: 'Mumbai Andheri', name: 'Pradeep Kadam', email: 'postman8@daksync.in', poCode: 'BOM-AND'),
  _DemoAgent(region: 'Pune HO', name: 'Pravin Joshi', email: 'postman10@daksync.in', poCode: 'PUN-HO'),
  _DemoAgent(region: 'Nagpur GPO', name: 'Anand Raut', email: 'postman12@daksync.in', poCode: 'NGP-GPO'),
];

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController(text: 'postman1@daksync.in');
  final _password = TextEditingController(text: 'post123');
  bool _obscure = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final state = context.read<AppState>();
    final ok = await state.login(_email.text, _password.text);
    if (!mounted) return;
    if (ok) {
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const RoutesScreen()),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(state.error ?? 'Login failed')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final scheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      height: 48,
                      width: 48,
                      decoration: BoxDecoration(
                        color: scheme.primary,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      alignment: Alignment.center,
                      child: const Text('DS',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
                    ),
                    const SizedBox(width: 12),
                    const Text('DAKSYNC',
                        style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(height: 6),
                Text('Postman field app · डाक सेवक',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w600, fontSize: 15)),
                const SizedBox(height: 28),
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Postman Email',
                    prefixIcon: Icon(Icons.mail_outline),
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _password,
                  obscureText: _obscure,
                  onSubmitted: (_) => _submit(),
                  decoration: InputDecoration(
                    labelText: 'Password',
                    prefixIcon: const Icon(Icons.lock_outline),
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                PrimaryButton(
                  label: 'Sign in to Beat Route',
                  loading: state.loading,
                  onPressed: _submit,
                  icon: Icons.login,
                ),
                const SizedBox(height: 24),
                // Demo Postmen Switcher across 6 regions
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '⚡ 1-TAP DEMO REGIONAL POSTMEN',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF64748B),
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _kDemoAgents.map((agent) {
                          final isSelected = _email.text == agent.email;
                          return InkWell(
                            borderRadius: BorderRadius.circular(8),
                            onTap: () {
                              setState(() {
                                _email.text = agent.email;
                                _password.text = 'post123';
                              });
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: isSelected ? scheme.primary.withOpacity(0.12) : Colors.white,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: isSelected ? scheme.primary : const Color(0xFFCBD5E1),
                                  width: isSelected ? 1.5 : 1,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    agent.region,
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: isSelected ? scheme.primary : const Color(0xFF1E293B),
                                    ),
                                  ),
                                  Text(
                                    '${agent.name} (${agent.poCode})',
                                    style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Password: post123 (covers all 14 postmen across 6 regions)',
                        style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
