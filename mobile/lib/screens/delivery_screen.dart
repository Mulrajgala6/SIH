import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../state/app_state.dart';
import '../widgets/otp_input.dart';
import '../widgets/primary_button.dart';
import '../widgets/status_chip.dart';

enum _Step { idle, awaitingOtp, verified, done }

/// The per-stop delivery flow: start → OTP → complete, with a fail path.
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
    setState(() => _busy = true);
    try {
      final res = await _api.completeDelivery(_cid);
      setState(() {
        _step = _Step.done;
        _changed = true;
        _message = 'Delivered · ${res.status}';
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
    final result = await showDialog<_FailChoice>(
      context: context,
      builder: (_) => const _FailDialog(),
    );
    if (result == null) return;
    setState(() => _busy = true);
    try {
      await _api.failDelivery(_cid, result.reason, result.notes);
      setState(() {
        _step = _Step.done;
        _changed = true;
        _message = 'Marked as failed';
      });
    } on ApiException catch (e) {
      _snack(e.message);
    } catch (_) {
      _snack('Could not mark as failed.');
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
          title: const Text('Delivery'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.of(context).pop(_changed),
          ),
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _recipientCard(c),
            const SizedBox(height: 16),
            _stepCard(),
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
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                ),
                StatusChip(c.status),
              ],
            ),
            const SizedBox(height: 6),
            _iconRow(Icons.location_on_outlined, c.address.oneLine),
            const SizedBox(height: 4),
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
                const Text('Ready to deliver this parcel?',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                const Text('Starting sends a one-time password (OTP) to the recipient.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                const SizedBox(height: 16),
                PrimaryButton(
                    label: 'Start delivery',
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
                if (_demoOtp != null) _demoOtpBanner(_demoOtp!),
                const SizedBox(height: 12),
                const Text('Enter the OTP from the recipient',
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
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const Icon(Icons.check_circle, color: Color(0xFF15803D), size: 44),
                const SizedBox(height: 8),
                const Text('OTP verified',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF15803D))),
                const SizedBox(height: 16),
                PrimaryButton(
                    label: 'Complete delivery',
                    icon: Icons.done_all,
                    loading: _busy,
                    color: const Color(0xFF15803D),
                    onPressed: _complete),
              ],
            ),
          ),
        );

      case _Step.done:
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const Icon(Icons.task_alt, color: Color(0xFF254F87), size: 52),
                const SizedBox(height: 12),
                Text(_message ?? 'Done',
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                const SizedBox(height: 16),
                PrimaryButton(
                    label: 'Back to route',
                    icon: Icons.arrow_back,
                    onPressed: () => Navigator.of(context).pop(true)),
              ],
            ),
          ),
        );
    }
  }

  Widget _demoOtpBanner(String otp) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      decoration: BoxDecoration(
        color: const Color(0xFFEEF4FB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFB6CEE9)),
      ),
      child: Column(
        children: [
          const Text('Demo OTP (shown for presentation) · डेमो ओटीपी',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Color(0xFF254F87), fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text(otp,
              style: const TextStyle(
                  fontSize: 32, fontWeight: FontWeight.w800, letterSpacing: 10, color: Color(0xFF1D3E6B))),
        ],
      ),
    );
  }
}

class _FailChoice {
  final String reason;
  final String? notes;
  _FailChoice(this.reason, this.notes);
}

class _FailDialog extends StatefulWidget {
  const _FailDialog();

  @override
  State<_FailDialog> createState() => _FailDialogState();
}

class _FailDialogState extends State<_FailDialog> {
  static const _reasons = {
    'RECIPIENT_UNAVAILABLE': 'Recipient unavailable',
    'WRONG_ADDRESS': 'Wrong address',
    'REFUSED': 'Refused delivery',
    'OTHER': 'Other',
  };
  String _reason = 'RECIPIENT_UNAVAILABLE';
  final _notes = TextEditingController();

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Mark delivery failed'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ..._reasons.entries.map((e) => RadioListTile<String>(
                contentPadding: EdgeInsets.zero,
                dense: true,
                value: e.key,
                groupValue: _reason,
                title: Text(e.value),
                onChanged: (v) => setState(() => _reason = v!),
              )),
          const SizedBox(height: 8),
          TextField(
            controller: _notes,
            decoration: const InputDecoration(
              labelText: 'Notes (optional)',
              border: OutlineInputBorder(),
            ),
            maxLines: 2,
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFFB32B2B)),
          onPressed: () => Navigator.pop(context, _FailChoice(_reason, _notes.text)),
          child: const Text('Confirm failure'),
        ),
      ],
    );
  }
}
