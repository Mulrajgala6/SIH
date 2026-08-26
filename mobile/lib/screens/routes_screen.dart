import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../models/models.dart';
import '../services/map_launcher.dart';
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
    final user = state.user;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('My Delivery Run Sheets'),
            if (user != null)
              Text(
                '${user.fullName} · ${user.postOffice?.name ?? "Regional Beat"}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.normal),
              ),
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
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (user?.postOffice != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFBFDBFE)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.location_city, size: 18, color: Color(0xFF1D4ED8)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Serving: ${user!.postOffice!.name} (${user.postOffice!.code}) · PIN ${user.postOffice!.pincode}',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF1E40AF),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ...routes.map((r) => _RouteCard(route: r)),
              ],
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
    final pendingStops = route.stops.where((s) => s.status == 'PENDING').toList();
    final nextStop = pendingStops.isNotEmpty ? pendingStops.first : null;

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      elevation: 2,
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
                    child: Row(
                      children: [
                        Text('Route #${route.id}',
                            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                        const SizedBox(width: 8),
                        if (route.postOffice != null)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              route.postOffice!.code,
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF475569)),
                            ),
                          ),
                      ],
                    ),
                  ),
                  StatusChip(route.status),
                ],
              ),
              const SizedBox(height: 4),
              Text(route.agent?.name ?? 'Assigned Beat Postman',
                  style: const TextStyle(color: Color(0xFF475569), fontSize: 13)),
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
              Row(
                mainAxisAlignment: MainAxisAlignment.between,
                children: [
                  Text('$delivered of ${route.totalStops} delivered',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  if (nextStop != null &&
                      nextStop.consignment.address.latitude != null &&
                      nextStop.consignment.address.longitude != null)
                    InkWell(
                      onTap: () {
                        MapLauncher.openTurnByTurn(
                          nextStop.consignment.address.latitude!,
                          nextStop.consignment.address.longitude!,
                          label: nextStop.consignment.recipient.name,
                        );
                      },
                      child: const Row(
                        children: [
                          Icon(Icons.directions_bike, size: 14, color: Color(0xFF0284C7)),
                          SizedBox(width: 4),
                          Text(
                            'Navigate Next',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0284C7),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
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
