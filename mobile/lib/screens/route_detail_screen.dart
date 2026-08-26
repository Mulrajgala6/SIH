import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/map_launcher.dart';
import '../state/app_state.dart';
import '../widgets/route_map_view.dart';
import '../widgets/status_chip.dart';
import 'delivery_screen.dart';

/// Ordered stops for one route (the run sheet). Each stop shows ETA, recipient,
/// address, and the confirmed slot; tap to open the delivery flow.
class RouteDetailScreen extends StatefulWidget {
  final int routeId;
  const RouteDetailScreen({super.key, required this.routeId});

  @override
  State<RouteDetailScreen> createState() => _RouteDetailScreenState();
}

class _RouteDetailScreenState extends State<RouteDetailScreen> {
  DeliveryRoute? _route;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final route = await context.read<AppState>().api.getRoute(widget.routeId);
      if (!mounted) return;
      setState(() {
        _route = route;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load the route.';
        _loading = false;
      });
    }
  }

  Future<void> _openStop(RouteStop stop) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => DeliveryScreen(stop: stop)),
    );
    if (changed == true) _load();
  }

  void _showRouteMapModal(BuildContext context, DeliveryRoute route) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (_, scrollController) => RouteMapView(route: route),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final route = _route;
    return Scaffold(
      appBar: AppBar(
        title: Text(route == null ? 'Route' : 'Route #${route.id}'),
        actions: [
          if (route != null)
            IconButton(
              icon: const Icon(Icons.map_outlined),
              tooltip: 'View Route Map',
              onPressed: () => _showRouteMapModal(context, route),
            ),
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, size: 48, color: Color(0xFFB32B2B)),
                        const SizedBox(height: 12),
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        OutlinedButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : _buildBody(route!),
    );
  }

  Widget _buildBody(DeliveryRoute route) {
    final pendingStops = route.stops.where((s) => s.status == 'PENDING').toList();
    final nextStop = pendingStops.isNotEmpty ? pendingStops.first : null;
    final depotName = route.postOffice != null
        ? '${route.postOffice!.name} (${route.postOffice!.code})'
        : 'Assigned Regional Office';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Depot & Route summary header
        Card(
          elevation: 2,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.between,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(route.agent?.name ?? 'Assigned Beat Postman',
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              const Icon(Icons.location_city, size: 14, color: Color(0xFF64748B)),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  depotName,
                                  style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    StatusChip(route.status),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _InfoBadge(
                      icon: Icons.location_on_outlined,
                      label: '${route.totalStops} stops',
                    ),
                    const SizedBox(width: 10),
                    _InfoBadge(
                      icon: Icons.route_outlined,
                      label: '${route.totalDistanceKm.toStringAsFixed(1)} km',
                    ),
                    const SizedBox(width: 10),
                    _InfoBadge(
                      icon: Icons.schedule,
                      label: 'Start ${minutesToLabel(route.plannedStartMinutes)}',
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // Route Map Action Button
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF0284C7),
                    side: const BorderBorder(color: Color(0xFFBAE6FD)),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  ),
                  icon: const Icon(Icons.map, size: 18),
                  label: const Text('View Full Sequenced Route on Map'),
                  onPressed: () => _showRouteMapModal(context, route),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),

        // --- NEXT DELIVERY ACTION CARD ---
        if (nextStop != null) ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0369A1), Color(0xFF0284C7)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0284C7).withOpacity(0.3),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.between,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '⚡ NEXT STOP #${nextStop.sequence}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    Text(
                      'ETA ${minutesToLabel(nextStop.etaMinutes)}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  nextStop.consignment.recipient.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  nextStop.consignment.address.oneLine,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.9),
                    fontSize: 13,
                  ),
                ),
                if (nextStop.consignment.confirmedSlot != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    '⏰ Confirmed Window: ${nextStop.consignment.confirmedSlot!.bilingualLabel}',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.95),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                Row(
                  children: [
                    // Start GPS Navigation
                    if (nextStop.consignment.address.latitude != null &&
                        nextStop.consignment.address.longitude != null)
                      Expanded(
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: const Color(0xFF0369A1),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                          icon: const Icon(Icons.directions_bike, size: 18),
                          label: const Text('Start GPS Navigation'),
                          onPressed: () {
                            MapLauncher.openTurnByTurn(
                              nextStop.consignment.address.latitude!,
                              nextStop.consignment.address.longitude!,
                              label: nextStop.consignment.recipient.name,
                            );
                          },
                        ),
                      ),
                    const SizedBox(width: 8),
                    // Deliver
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16A34A),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      icon: const Icon(Icons.verified, size: 16),
                      label: const Text('Deliver'),
                      onPressed: () => _openStop(nextStop),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        const Text(
          'All Sequenced Stops',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
        ),
        const SizedBox(height: 8),
        ...route.stops.map((s) => _StopTile(stop: s, onTap: () => _openStop(s))),
      ],
    );
  }
}

class _InfoBadge extends StatelessWidget {
  final IconData icon;
  final String label;

  const _InfoBadge({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: const Color(0xFF475569)),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF334155))),
        ],
      ),
    );
  }
}

class _StopTile extends StatelessWidget {
  final RouteStop stop;
  final VoidCallback onTap;
  const _StopTile({required this.stop, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = stop.consignment;
    final scheme = Theme.of(context).colorScheme;
    final hasCoords = c.address.latitude != null && c.address.longitude != null;
    final isCompleted = stop.status == 'COMPLETED';

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: isCompleted
                    ? const Color(0xFF16A34A)
                    : stop.status == 'FAILED'
                        ? const Color(0xFFDC2626)
                        : scheme.primary,
                child: isCompleted
                    ? const Icon(Icons.check, color: Colors.white, size: 16)
                    : Text(
                        '${stop.sequence}',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            c.recipient.name,
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              decoration: isCompleted ? TextDecoration.lineThrough : null,
                            ),
                          ),
                        ),
                        Text('ETA ${minutesToLabel(stop.etaMinutes)}',
                            style: TextStyle(color: scheme.primary, fontWeight: FontWeight.w600)),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(c.address.oneLine,
                        style: const TextStyle(color: Color(0xFF475569), fontSize: 13)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        if (c.confirmedSlot != null) ...[
                          const Icon(Icons.schedule, size: 14, color: Color(0xFF64748B)),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              '${c.confirmedSlot!.bilingualLabel} '
                              '(${minutesToLabel(c.confirmedSlot!.startMinutes)}–${minutesToLabel(c.confirmedSlot!.endMinutes)})',
                              style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
                            ),
                          ),
                          const SizedBox(width: 8),
                        ],
                        StatusChip(stop.status),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(c.trackingNumber,
                        style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                  ],
                ),
              ),
              if (hasCoords)
                IconButton(
                  tooltip: 'Navigate',
                  icon: const Icon(Icons.navigation, color: Color(0xFF0284C7), size: 22),
                  onPressed: () {
                    MapLauncher.openTurnByTurn(
                      c.address.latitude!,
                      c.address.longitude!,
                      label: c.recipient.name,
                    );
                  },
                )
              else
                const Icon(Icons.chevron_right, color: Color(0xFF94A3B8)),
            ],
          ),
        ),
      ),
    );
  }
}
