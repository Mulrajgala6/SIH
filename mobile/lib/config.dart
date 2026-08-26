/// Runtime configuration for the DAKSYNC postman app.
///
/// The API base URL is compile-time configurable so the same build can point at
/// a laptop backend (Flutter web / desktop) or an Android emulator:
///
///   flutter run -d chrome
///   flutter run --dart-define=API_BASE=http://10.0.2.2:8000   # Android emulator
library;

const String kApiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'https://sih-bqm3.onrender.com',
);

/// Everything below `/api/v1`.
const String kApiPrefix = '/api/v1';

/// Format minutes-from-midnight (e.g. 615) as a friendly clock label ("10:15 AM").
String minutesToLabel(int? minutes) {
  if (minutes == null) return '—';
  final h24 = (minutes ~/ 60) % 24;
  final m = minutes % 60;
  final period = h24 < 12 ? 'AM' : 'PM';
  var h12 = h24 % 12;
  if (h12 == 0) h12 = 12;
  final mm = m.toString().padLeft(2, '0');
  return m == 0 ? '$h12 $period' : '$h12:$mm $period';
}
