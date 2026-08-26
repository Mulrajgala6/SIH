import 'package:flutter/material.dart';

/// A small colored pill for consignment / route / stop statuses.
class StatusChip extends StatelessWidget {
  final String status;
  const StatusChip(this.status, {super.key});

  static const _colors = <String, Color>{
    // consignment
    'BOOKED': Color(0xFF64748B),
    'COLLECTED': Color(0xFF64748B),
    'SORTED': Color(0xFF64748B),
    'SLOT_PENDING': Color(0xFFB45309),
    'SLOT_CONFIRMED': Color(0xFF254F87),
    'OUT_FOR_DELIVERY': Color(0xFF7C3AED),
    'DELIVERED': Color(0xFF15803D),
    'DELIVERY_FAILED': Color(0xFFB32B2B),
    'RESCHEDULED': Color(0xFFB45309),
    'RETURNED': Color(0xFFB32B2B),
    // route / stop
    'PLANNED': Color(0xFF64748B),
    'DISPATCHED': Color(0xFF254F87),
    'IN_PROGRESS': Color(0xFF7C3AED),
    'COMPLETED': Color(0xFF15803D),
    'PENDING': Color(0xFF64748B),
    'ARRIVED': Color(0xFF7C3AED),
    'FAILED': Color(0xFFB32B2B),
    'SKIPPED': Color(0xFF94A3B8),
  };

  @override
  Widget build(BuildContext context) {
    final color = _colors[status] ?? const Color(0xFF64748B);
    final label = status.replaceAll('_', ' ');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}
