import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import '../widgets/status_chip.dart';
import 'login_screen.dart';
import 'route_detail_screen.dart';

/// Today's run sheets for the logged-in postman. Tapping a route opens its
/// ordered stops.
class RoutesScreen extends StatefulWidget {
  const RoutesScreen({super.key});

  @override
  State<RoutesScreen> createState() => _RoutesScreenState();
}

class _RoutesScreenState extends State<RoutesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppState>().refreshRoutes();
    });
  }

  void _logout() {
    context.read<AppState>().logout();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final routes = state.routes;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('My routes'),
            if (state.user != null)
              Text(state.user!.fullName,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal)),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: () => context.read<AppState>().refreshRoutes(),
          ),
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: _logout,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => context.read<AppState>().refreshRoutes(),
        child: Builder(
          builder: (context) {
            if (state.loading && routes.isEmpty) {
              return const Center(child: CircularProgressIndicator());
            }
            if (state.error != null && routes.isEmpty) {
              return _ErrorState(message: state.error!, onRetry: () => state.refreshRoutes());
            }
            if (routes.isEmpty) {
              return _EmptyState();
            }
            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: routes.length,
              itemBuilder: (context, i) => _RouteCard(route: routes[i]),
            );
          },
        ),
      ),
    );
  }
}

class _RouteCard extends StatelessWidget {
  final DeliveryRoute route;
  const _RouteCard({required this.route});

  @override
  Widget build(BuildContext context) {
    final delivered = route.stops.where((s) => s.status == 'COMPLETED').length;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => RouteDetailScreen(routeId: route.id)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text('Route #${route.id}',
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                  ),
                  StatusChip(route.status),
                ],
              ),
              const SizedBox(height: 4),
              Text(route.agent?.name ?? 'Unassigned',
                  style: const TextStyle(color: Color(0xFF475569))),
              const SizedBox(height: 12),
              Row(
                children: [
                  _Metric(icon: Icons.location_on_outlined, label: '${route.totalStops} stops'),
                  const SizedBox(width: 16),
                  _Metric(
                      icon: Icons.route_outlined,
                      label: '${route.totalDistanceKm.toStringAsFixed(1)} km'),
                  const SizedBox(width: 16),
                  _Metric(
                      icon: Icons.schedule,
                      label: 'from ${minutesToLabel(route.plannedStartMinutes)}'),
                ],
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: route.totalStops == 0 ? 0 : delivered / route.totalStops,
                  minHeight: 6,
                  backgroundColor: const Color(0xFFE2E8F0),
                ),
              ),
              const SizedBox(height: 6),
              Text('$delivered of ${route.totalStops} delivered',
                  style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
            ],
          ),
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  final IconData icon;
  final String label;
  const _Metric({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF64748B)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 13, color: Color(0xFF475569))),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView(
      children: const [
        SizedBox(height: 120),
        Icon(Icons.inbox_outlined, size: 56, color: Color(0xFF94A3B8)),
        SizedBox(height: 12),
        Center(
          child: Text('No routes yet today.\nAsk the supervisor to optimize routes.',
              textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF64748B))),
        ),
      ],
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 120),
        const Icon(Icons.error_outline, size: 56, color: Color(0xFFB32B2B)),
        const SizedBox(height: 12),
        Center(child: Text(message, textAlign: TextAlign.center)),
        const SizedBox(height: 16),
        Center(child: OutlinedButton(onPressed: onRetry, child: const Text('Retry'))),
      ],
    );
  }
}
