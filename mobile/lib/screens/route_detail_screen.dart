import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';
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

  @override
  Widget build(BuildContext context) {
    final route = _route;
    return Scaffold(
      appBar: AppBar(
        title: Text(route == null ? 'Route' : 'Route #${route.id}'),
        actions: [
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
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(route.agent?.name ?? 'Unassigned',
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                      const SizedBox(height: 4),
                      Text(
                        '${route.totalStops} stops · ${route.totalDistanceKm.toStringAsFixed(1)} km · '
                        'start ${minutesToLabel(route.plannedStartMinutes)}',
                        style: const TextStyle(color: Color(0xFF475569), fontSize: 13),
                      ),
                      if (route.optimizer != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text('optimizer: ${route.optimizer}',
                              style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
                        ),
                    ],
                  ),
                ),
                StatusChip(route.status),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        ...route.stops.map((s) => _StopTile(stop: s, onTap: () => _openStop(s))),
      ],
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
                backgroundColor: scheme.primary,
                child: Text('${stop.sequence}',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(c.recipient.name,
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
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
              const Icon(Icons.chevron_right, color: Color(0xFF94A3B8)),
            ],
          ),
        ),
      ),
    );
  }
}
