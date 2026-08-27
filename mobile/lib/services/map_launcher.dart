import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

/// Helper to launch navigation in Google Maps or OpenStreetMap across Web, Android, and iOS.
class MapLauncher {
  /// Open turn-by-turn navigation in Google Maps / Map Application to the target GPS coordinate.
  static Future<bool> openTurnByTurn(double lat, double lng, {String? label}) async {
    // Standard Universal Google Maps Direction URL (works on Android, iOS, and Web)
    final googleMapsUrl =
        'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=two-wheeler';
    final uri = Uri.parse(googleMapsUrl);

    try {
      if (await canLaunchUrl(uri)) {
        return await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        return await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
    } catch (e) {
      debugPrint('Could not launch map URL: $e');
      return false;
    }
  }

  /// Open full multi-stop sequenced route in Google Maps
  static Future<bool> openMultiStopRoute(List<Map<String, dynamic>> coordinates) async {
    if (coordinates.isEmpty) return false;
    if (coordinates.length == 1) {
      final c = coordinates.first;
      return openTurnByTurn(c['lat'] as double, c['lng'] as double, label: c['label'] as String?);
    }

    final origin = '${coordinates.first['lat']},${coordinates.first['lng']}';
    final destination = '${coordinates.last['lat']},${coordinates.last['lng']}';

    String waypointsParam = '';
    if (coordinates.length > 2) {
      final waypoints = coordinates
          .sublist(1, coordinates.length - 1)
          .map((c) => '${c['lat']},${c['lng']}')
          .join('|');
      waypointsParam = '&waypoints=${Uri.encodeComponent(waypoints)}';
    }

    final routeUrl =
        'https://www.google.com/maps/dir/?api=1&origin=$origin&destination=$destination$waypointsParam&travelmode=two-wheeler';
    final uri = Uri.parse(routeUrl);

    try {
      if (await canLaunchUrl(uri)) {
        return await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        return await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
    } catch (e) {
      debugPrint('Could not launch multi-stop map URL: $e');
      return false;
    }
  }

  /// Launch phone call to customer
  static Future<bool> makePhoneCall(String phoneNumber) async {
    final uri = Uri.parse('tel:$phoneNumber');
    try {
      if (await canLaunchUrl(uri)) {
        return await launchUrl(uri);
      }
    } catch (e) {
      debugPrint('Could not launch phone call: $e');
    }
    return false;
  }

  /// Launch WhatsApp with prefilled message to customer
  static Future<bool> sendWhatsApp(String phoneNumber, String message) async {
    String cleaned = phoneNumber.replaceAll(RegExp(r'\D'), '');
    if (cleaned.length == 10) {
      cleaned = '91$cleaned';
    }
    final encodedMsg = Uri.encodeComponent(message);
    final url = 'https://wa.me/$cleaned?text=$encodedMsg';
    final uri = Uri.parse(url);
    try {
      if (await canLaunchUrl(uri)) {
        return await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        return await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
    } catch (e) {
      debugPrint('Could not launch WhatsApp: $e');
      return false;
    }
  }
}
