import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/map_launcher.dart';
import '../state/app_state.dart';
import '../widgets/otp_input.dart';
import '../widgets/primary_button.dart';
import '../widgets/status_chip.dart';

enum _Step { idle, awaitingOtp, verified, done }

/// The per-stop delivery flow: start → OTP → complete, with a fail path and GPS map navigation.
class DeliveryScreen extends StatefulWidget {
  final RouteStop stop;
  const DeliveryScreen({super.key, required this.stop});

  @override
  State<DeliveryScreen> createState() => _DeliveryScreenState();
}

class _DeliveryScreenState extends State<DeliveryScreen> {
  _Step _step = _Step.idle;
  bool _busy = false;
  String? _demoOtp;
  int? _attemptsRemaining;
  String? _message;
  bool _changed = false;
  final _otp = TextEditingController();

  int get _cid => widget.stop.consignment.id;
  ApiClient get _api => context.read<AppState>().api;

  @override
  void initState() {
    super.initState();
    // If this stop is already out for delivery, jump straight to OTP entry.
    if (widget.stop.consignment.status == 'OUT_FOR_DELIVERY' ||
        widget.stop.status == 'ARRIVED') {
      _step = _Step.awaitingOtp;
    }
  }

  @override
  void dispose() {
    _otp.dispose();
    super.dispose();
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _start() async {
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final res = await _api.startDelivery(_cid);
      setState(() {
        _demoOtp = res.demoOtp;
        _step = _Step.awaitingOtp;
        _changed = true;
      });
    } on ApiException catch (e) {
      _snack(e.message);
    } catch (_) {
      _snack('Could not start delivery.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    if (_otp.text.length < 4) {
      _snack('Enter the 4-digit OTP');
      return;
    }
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final res = await _api.verifyOtp(_cid, _otp.text);
      setState(() {
        _attemptsRemaining = res.attemptsRemaining;
        if (res.verified) {
          _step = _Step.verified;
          _message = null;
        } else {
          _message = res.detail ?? 'Incorrect OTP';
        }
      });
    } on ApiException catch (e) {
      _snack(e.message);
    } catch (_) {
      _snack('Could not verify OTP.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _complete() async {
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await _api.completeDelivery(_cid);
      setState(() {
        _step = _Step.done;
        _changed = true;
      });
    } on ApiException catch (e) {
      _snack(e.message);
    } catch (_) {
      _snack('Could not complete delivery.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _fail() async {
    String reason = 'RECIPIENT_UNAVAILABLE';
    final notes = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('Record failed attempt'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: reason,
                decoration: const InputDecoration(labelText: 'Reason'),
                items: const [
                  DropdownMenuItem(value: 'RECIPIENT_UNAVAILABLE', child: Text('Recipient not available')),
                  DropdownMenuItem(value: 'DOOR_LOCKED', child: Text('Door locked / premises closed')),
                  DropdownMenuItem(value: 'WRONG_ADDRESS', child: Text('Incorrect address / moved')),
                  DropdownMenuItem(value: 'CUSTOMER_REFUSED', child: Text('Customer refused parcel')),
                  DropdownMenuItem(value: 'OTP_EXPIRED', child: Text('OTP expired / not received')),
                  DropdownMenuItem(value: 'SECURITY_RESTRICTION', child: Text('Gated community / access denied')),
                  DropdownMenuItem(value: 'OTHER', child: Text('Other reason')),
                ],
                onChanged: (v) => setDialogState(() => reason = v ?? reason),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: notes,
                decoration: const InputDecoration(labelText: 'Notes (optional)'),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFB32B2B)),
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Record failure', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      ),
    );

    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await _api.failDelivery(_cid, reason, notes.text.trim().isEmpty ? null : notes.text.trim());
      _changed = true;
      if (!mounted) return;
      Navigator.of(context).pop(_changed);
    } on ApiException catch (e) {
      _snack(e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.stop.consignment;
    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, _) {},
      child: Scaffold(
        appBar: AppBar(
          title: Text('Stop #${widget.stop.sequence} Delivery'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.of(context).pop(_changed),
          ),
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _destinationMapCard(c),
            const SizedBox(height: 14),
            _recipientCard(c),
            const SizedBox(height: 14),
            _stepCard(),
          ],
        ),
      ),
    );
  }

  Widget _destinationMapCard(ConsignmentBrief c) {
    final lat = c.address.latitude;
    final lng = c.address.longitude;
    final hasCoords = lat != null && lng != null;

    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.between,
              children: [
                const Row(
                  children: [
                    Icon(Icons.location_on, color: Color(0xFF0284C7), size: 20),
                    SizedBox(width: 6),
                    Text(
                      'Delivery Location & GPS',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF0F172A)),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: hasCoords ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    hasCoords ? '🛰️ Geocoded' : 'Pending GPS',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: hasCoords ? const Color(0xFF16A34A) : const Color(0xFF64748B),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              c.address.oneLine,
              style: const TextStyle(fontSize: 13, color: Color(0xFF334155), fontWeight: FontWeight.w500),
            ),
            if (hasCoords) ...[
              const SizedBox(height: 4),
              Text(
                'Coordinates: ${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                // 1-Click Map Navigation
                if (hasCoords)
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0284C7),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      icon: const Icon(Icons.directions_bike, size: 18),
                      label: const Text('Open Google Maps'),
                      onPressed: () {
                        MapLauncher.openTurnByTurn(lat, lng, label: c.recipient.name);
                      },
                    ),
                  ),
                if (c.recipient.phone.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF16A34A),
                      side: const BorderSide(color: Color(0xFF86EFAC)),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                    ),
                    icon: const Icon(Icons.phone, size: 16),
                    label: const Text('Call'),
                    onPressed: () => MapLauncher.makePhoneCall(c.recipient.phone),
                  ),
                  const SizedBox(width: 6),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF25D366),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                    ),
                    icon: const Icon(Icons.chat, size: 16),
                    label: const Text('WhatsApp'),
                    onPressed: () {
                      final msg = _demoOtp != null
                          ? 'Namaste ${c.recipient.name}, your India Post parcel (${c.trackingNumber}) is OUT FOR DELIVERY! 🚚📦\n\nYour Delivery Verification OTP is: $_demoOtp\n\nनमस्ते ${c.recipient.name}, आपका पार्सल आ चुका है। आपका OTP है: $_demoOtp'
                          : 'Namaste ${c.recipient.name}, your India Post parcel (${c.trackingNumber}) is OUT FOR DELIVERY by your postman! 🚚📦';
                      MapLauncher.sendWhatsApp(c.recipient.phone, msg);
                    },
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _recipientCard(ConsignmentBrief c) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(c.recipient.name,
                      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                ),
                StatusChip(c.status),
              ],
            ),
            const SizedBox(height: 6),
            _iconRow(Icons.phone_outlined, c.recipient.phone),
            if (c.confirmedSlot != null) ...[
              const SizedBox(height: 4),
              _iconRow(
                Icons.schedule,
                '${c.confirmedSlot!.bilingualLabel} · '
                '${minutesToLabel(c.confirmedSlot!.startMinutes)}–${minutesToLabel(c.confirmedSlot!.endMinutes)}',
              ),
            ],
            const SizedBox(height: 4),
            _iconRow(Icons.qr_code_2, c.trackingNumber),
          ],
        ),
      ),
    );
  }

  Widget _iconRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF64748B)),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(color: Color(0xFF334155)))),
        ],
      ),
    );
  }

  Widget _stepCard() {
    switch (_step) {
      case _Step.idle:
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const Text('Arrived at destination?',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                const Text('Starting triggers SMS/In-App OTP to the recipient for handover verification.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                const SizedBox(height: 16),
                PrimaryButton(
                    label: 'Start delivery & send OTP',
                    icon: Icons.local_shipping_outlined,
                    loading: _busy,
                    onPressed: _start),
                const SizedBox(height: 8),
                PrimaryButton(
                    label: 'Mark as failed',
                    secondary: true,
                    color: const Color(0xFFB32B2B),
                    onPressed: _busy ? null : _fail),
              ],
            ),
          ),
        );

      case _Step.awaitingOtp:
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_demoOtp != null) _demoOtpBanner(_demoOtp!, widget.stop.consignment),
                const SizedBox(height: 12),
                const Text('Enter the OTP provided by the recipient',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                const SizedBox(height: 16),
                OtpInput(
                  controller: _otp,
                  onChanged: (_) {
                    if (_message != null) setState(() => _message = null);
                  },
                  onCompleted: (_) => _verify(),
                ),
                if (_attemptsRemaining != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('$_attemptsRemaining attempt(s) remaining',
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  ),
                if (_message != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(_message!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Color(0xFFB32B2B), fontWeight: FontWeight.w600)),
                  ),
                const SizedBox(height: 16),
                PrimaryButton(
                    label: 'Verify OTP', icon: Icons.verified_outlined, loading: _busy, onPressed: _verify),
                const SizedBox(height: 8),
                PrimaryButton(
                    label: 'Mark as failed',
                    secondary: true,
                    color: const Color(0xFFB32B2B),
                    onPressed: _busy ? null : _fail),
              ],
            ),
          ),
        );

      case _Step.verified:
        return Card(
          color: const Color(0xFFF0FDF4),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const Icon(Icons.check_circle_outline, size: 48, color: Color(0xFF1B7A3E)),
                const SizedBox(height: 8),
                const Text('OTP Verified',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF1B7A3E))),
                const SizedBox(height: 4),
                const Text('Hand over parcel and tap complete.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF1E293B), fontSize: 13)),
                const SizedBox(height: 16),
                PrimaryButton(
                  label: 'Complete delivery',
                  icon: Icons.done_all,
                  loading: _busy,
                  color: const Color(0xFF1B7A3E),
                  onPressed: _complete,
                ),
              ],
            ),
          ),
        );

      case _Step.done:
        return Card(
          color: const Color(0xFFF0FDF4),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                const Icon(Icons.task_alt, size: 56, color: Color(0xFF1B7A3E)),
                const SizedBox(height: 12),
                const Text('Delivered successfully!',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF1B7A3E))),
                const SizedBox(height: 4),
                const Text('Proof of delivery logged with India Post tracking.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF475569), fontSize: 13)),
                const SizedBox(height: 16),
                PrimaryButton(
                  label: 'Back to run sheet',
                  icon: Icons.arrow_back,
                  onPressed: () => Navigator.of(context).pop(_changed),
                ),
              ],
            ),
          ),
        );
    }
  }

  Widget _demoOtpBanner(String code, ConsignmentBrief c) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF3C7),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFDE68A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.sms_outlined, color: Color(0xFFB45309), size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text('Demo Delivery OTP: $code',
                    style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF92400E), fontSize: 14)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF25D366),
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 8),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              icon: const Icon(Icons.send_rounded, size: 16),
              label: const Text('Send Out for Delivery & OTP on WhatsApp',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
              onPressed: () {
                final msg =
                    'Namaste ${c.recipient.name}, your India Post parcel (${c.trackingNumber}) is OUT FOR DELIVERY! 🚚📦\n\nYour Delivery Verification OTP is: $code\n\nPlease share this 4-digit code with the postman at your doorstep.\n\nनमस्ते ${c.recipient.name}, आपका पार्सल डिलीवरी के लिए निकल चुका है। आपका OTP है: $code';
                MapLauncher.sendWhatsApp(c.recipient.phone, msg);
              },
            ),
          ),
        ],
      ),
    );
  }
}
