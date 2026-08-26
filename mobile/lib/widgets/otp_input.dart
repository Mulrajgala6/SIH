import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// A simple, robust numeric OTP field (single input, large spaced digits).
/// Calls [onChanged] as the code is typed and [onCompleted] when [length]
/// digits have been entered.
class OtpInput extends StatelessWidget {
  final int length;
  final ValueChanged<String> onChanged;
  final ValueChanged<String>? onCompleted;
  final TextEditingController controller;

  const OtpInput({
    super.key,
    required this.controller,
    required this.onChanged,
    this.onCompleted,
    this.length = 4,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: TextInputType.number,
      textAlign: TextAlign.center,
      maxLength: length,
      autofocus: true,
      style: const TextStyle(
        fontSize: 34,
        fontWeight: FontWeight.w700,
        letterSpacing: 16,
      ),
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      decoration: InputDecoration(
        counterText: '',
        hintText: '••••'.substring(0, length),
        hintStyle: TextStyle(letterSpacing: 16, color: Colors.grey.shade300),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      ),
      onChanged: (v) {
        onChanged(v);
        if (v.length == length) onCompleted?.call(v);
      },
    );
  }
}
