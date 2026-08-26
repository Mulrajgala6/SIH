import 'package:flutter/material.dart';

import '../config.dart';
import '../models/models.dart';
import '../services/map_launcher.dart';

class RouteMapView extends StatelessWidget {
  final DeliveryRoute route;

  const RouteMapView({super.key, required this.route});

  @override
  Widget build(BuildContext context) {
    final stopsWithCoords = route.stops
        .where((s) =>
            s.consignment.address.latitude != null &&
            s.consignment.address.longitude != null)
        .toList();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              color: Color(0xFF0F172A),
              borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.between,
              children: [
                Row(
                  children: [
                    const Icon(Icons.map_outlined, color: Colors.white, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'Sequenced Route #${route.id}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
                Text(
                  '${route.totalDistanceKm.toStringAsFixed(1)} km · ${route.stops.length} stops',
                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                ),
              ],
            ),
          ),

          // Master Google Maps Launch Banner
          if (stopsWithCoords.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: const Color(0xFF0284C7),
              child: Row(
                children: [
                  const Icon(Icons.directions_bike, color: Colors.white, size: 20),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'Turn-by-turn route planned by DAKSYNC AI',
                      style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF0284C7),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      textStyle: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                    icon: const Icon(Icons.open_in_new, size: 14),
                    label: const Text('Open in Google Maps'),
                    onPressed: () {
                      final coords = stopsWithCoords
                          .map((s) => {
                                'lat': s.consignment.address.latitude!,
                                'lng': s.consignment.address.longitude!,
                                'label': s.consignment.recipient.name,
                              })
                          .toList();
                      MapLauncher.openMultiStopRoute(coords);
                    },
                  ),
                ],
              ),
            ),

          // Visual Stops Timeline
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: route.stops.length,
              separatorBuilder: (_, __) => Padding(
                padding: const EdgeInsets.only(left: 18),
                child: Container(
                  width: 2,
                  height: 24,
                  color: const Color(0xFFCBD5E1),
                ),
              ),
              itemBuilder: (context, index) {
                final stop = route.stops[index];
                final c = stop.consignment;
                final isCompleted = stop.status == 'COMPLETED';
                final hasCoords = c.address.latitude != null && c.address.longitude != null;

                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Sequence Badge
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: isCompleted
                          ? const Color(0xFF16A34A)
                          : index == 0
                              ? const Color(0xFF0284C7)
                              : const Color(0xFF64748B),
                      child: isCompleted
                          ? const Icon(Icons.check, color: Colors.white, size: 18)
                          : Text(
                              '${stop.sequence}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                    ),
                    const SizedBox(width: 12),
                    // Stop info
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
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                    decoration: isCompleted ? TextDecoration.lineThrough : null,
                                  ),
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  'ETA ${minutesToLabel(stop.etaMinutes)}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF0284C7),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            c.address.oneLine,
                            style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
                          ),
                          if (c.confirmedSlot != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              '⏰ Slot: ${c.confirmedSlot!.bilingualLabel}',
                              style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Quick Map Nav Button
                    if (hasCoords)
                      IconButton(
                        tooltip: 'Navigate to Stop #${stop.sequence}',
                        icon: const Icon(Icons.navigation, color: Color(0xFF0284C7), size: 20),
                        onPressed: () {
                          MapLauncher.openTurnByTurn(
                            c.address.latitude!,
                            c.address.longitude!,
                            label: c.recipient.name,
                          );
                        },
                      ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
