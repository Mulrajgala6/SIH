/// Data models for the DAKSYNC postman app. Each mirrors a response shape from
/// docs/API_CONTRACT.md; `fromJson` factories parse the backend payloads.
library;

class PostOfficeBrief {
  final int id;
  final String code;
  final String name;
  final String pincode;
  final double latitude;
  final double longitude;

  PostOfficeBrief({
    required this.id,
    required this.code,
    required this.name,
    required this.pincode,
    required this.latitude,
    required this.longitude,
  });

  factory PostOfficeBrief.fromJson(Map<String, dynamic> j) => PostOfficeBrief(
        id: j['id'] as int,
        code: j['code'] as String? ?? '',
        name: j['name'] as String? ?? '',
        pincode: j['pincode'] as String? ?? '',
        latitude: (j['latitude'] as num?)?.toDouble() ?? 0.0,
        longitude: (j['longitude'] as num?)?.toDouble() ?? 0.0,
      );
}

class AuthUser {
  final int id;
  final String email;
  final String fullName;
  final String role;
  final String? phone;
  final int? postOfficeId;
  final PostOfficeBrief? postOffice;

  AuthUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
    this.phone,
    this.postOfficeId,
    this.postOffice,
  });

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: j['id'] as int,
        email: j['email'] as String,
        fullName: j['full_name'] as String? ?? '',
        role: j['role'] as String? ?? '',
        phone: j['phone'] as String?,
        postOfficeId: j['post_office_id'] as int?,
        postOffice: j['post_office'] == null
            ? null
            : PostOfficeBrief.fromJson(j['post_office'] as Map<String, dynamic>),
      );
}

class LoginResult {
  final String accessToken;
  final AuthUser user;

  LoginResult({required this.accessToken, required this.user});

  factory LoginResult.fromJson(Map<String, dynamic> j) => LoginResult(
        accessToken: j['access_token'] as String,
        user: AuthUser.fromJson(j['user'] as Map<String, dynamic>),
      );
}

class Slot {
  final int id;
  final String code;
  final String labelEn;
  final String labelHi;
  final int startMinutes;
  final int endMinutes;

  Slot({
    required this.id,
    required this.code,
    required this.labelEn,
    required this.labelHi,
    required this.startMinutes,
    required this.endMinutes,
  });

  factory Slot.fromJson(Map<String, dynamic> j) => Slot(
        id: j['id'] as int,
        code: j['code'] as String? ?? '',
        labelEn: j['label_en'] as String? ?? '',
        labelHi: j['label_hi'] as String? ?? '',
        startMinutes: j['start_minutes'] as int? ?? 0,
        endMinutes: j['end_minutes'] as int? ?? 0,
      );

  /// "Evening · शाम"
  String get bilingualLabel => labelHi.isEmpty ? labelEn : '$labelEn · $labelHi';
}

class Recipient {
  final int id;
  final String name;
  final String phone;
  final String preferredLanguage;

  Recipient({
    required this.id,
    required this.name,
    required this.phone,
    required this.preferredLanguage,
  });

  factory Recipient.fromJson(Map<String, dynamic> j) => Recipient(
        id: j['id'] as int,
        name: j['name'] as String? ?? '',
        phone: j['phone'] as String? ?? '',
        preferredLanguage: j['preferred_language'] as String? ?? 'en',
      );
}

class Address {
  final int id;
  final String line1;
  final String? line2;
  final String locality;
  final String city;
  final String state;
  final String pincode;
  final double? latitude;
  final double? longitude;

  Address({
    required this.id,
    required this.line1,
    this.line2,
    required this.locality,
    required this.city,
    required this.state,
    required this.pincode,
    this.latitude,
    this.longitude,
  });

  factory Address.fromJson(Map<String, dynamic> j) => Address(
        id: j['id'] as int,
        line1: j['line1'] as String? ?? '',
        line2: j['line2'] as String?,
        locality: j['locality'] as String? ?? '',
        city: j['city'] as String? ?? '',
        state: j['state'] as String? ?? '',
        pincode: j['pincode'] as String? ?? '',
        latitude: (j['latitude'] as num?)?.toDouble(),
        longitude: (j['longitude'] as num?)?.toDouble(),
      );

  String get oneLine {
    final parts = [line1, if (line2 != null && line2!.isNotEmpty) line2, locality, '$city $pincode'];
    return parts.where((p) => p != null && p.toString().isNotEmpty).join(', ');
  }
}

class ConsignmentBrief {
  final int id;
  final String trackingNumber;
  final String status;
  final String priority;
  final Recipient recipient;
  final Address address;
  final Slot? confirmedSlot;

  ConsignmentBrief({
    required this.id,
    required this.trackingNumber,
    required this.status,
    required this.priority,
    required this.recipient,
    required this.address,
    this.confirmedSlot,
  });

  factory ConsignmentBrief.fromJson(Map<String, dynamic> j) => ConsignmentBrief(
        id: j['id'] as int,
        trackingNumber: j['tracking_number'] as String? ?? '',
        status: j['status'] as String? ?? '',
        priority: j['priority'] as String? ?? 'NORMAL',
        recipient: Recipient.fromJson(j['recipient'] as Map<String, dynamic>),
        address: Address.fromJson(j['address'] as Map<String, dynamic>),
        confirmedSlot: j['confirmed_slot'] == null
            ? null
            : Slot.fromJson(j['confirmed_slot'] as Map<String, dynamic>),
      );
}

class AgentBrief {
  final int id;
  final String name;
  final String? phone;

  AgentBrief({required this.id, required this.name, this.phone});

  factory AgentBrief.fromJson(Map<String, dynamic> j) => AgentBrief(
        id: j['id'] as int,
        name: j['name'] as String? ?? '',
        phone: j['phone'] as String?,
      );
}

class RouteStop {
  final int id;
  final int sequence;
  final String status;
  final int? etaMinutes;
  final double distanceFromPrevM;
  final ConsignmentBrief consignment;

  RouteStop({
    required this.id,
    required this.sequence,
    required this.status,
    required this.etaMinutes,
    required this.distanceFromPrevM,
    required this.consignment,
  });

  factory RouteStop.fromJson(Map<String, dynamic> j) => RouteStop(
        id: j['id'] as int,
        sequence: j['sequence'] as int? ?? 0,
        status: j['status'] as String? ?? 'PENDING',
        etaMinutes: j['eta_minutes'] as int?,
        distanceFromPrevM: (j['distance_from_prev_m'] as num?)?.toDouble() ?? 0.0,
        consignment: ConsignmentBrief.fromJson(j['consignment'] as Map<String, dynamic>),
      );
}

class DeliveryRoute {
  final int id;
  final int postOfficeId;
  final PostOfficeBrief? postOffice;
  final AgentBrief? agent;
  final String routeDate;
  final String status;
  final int plannedStartMinutes;
  final double totalDistanceM;
  final int totalStops;
  final String? optimizer;
  final List<RouteStop> stops;

  DeliveryRoute({
    required this.id,
    required this.postOfficeId,
    this.postOffice,
    required this.agent,
    required this.routeDate,
    required this.status,
    required this.plannedStartMinutes,
    required this.totalDistanceM,
    required this.totalStops,
    required this.optimizer,
    required this.stops,
  });

  factory DeliveryRoute.fromJson(Map<String, dynamic> j) => DeliveryRoute(
        id: j['id'] as int,
        postOfficeId: j['post_office_id'] as int? ?? 0,
        postOffice: j['post_office'] == null
            ? null
            : PostOfficeBrief.fromJson(j['post_office'] as Map<String, dynamic>),
        agent: j['agent'] == null ? null : AgentBrief.fromJson(j['agent'] as Map<String, dynamic>),
        routeDate: j['route_date'] as String? ?? '',
        status: j['status'] as String? ?? 'PLANNED',
        plannedStartMinutes: j['planned_start_minutes'] as int? ?? 600,
        totalDistanceM: (j['total_distance_m'] as num?)?.toDouble() ?? 0.0,
        totalStops: j['total_stops'] as int? ?? 0,
        optimizer: j['optimizer'] as String?,
        stops: ((j['stops'] as List<dynamic>?) ?? [])
            .map((s) => RouteStop.fromJson(s as Map<String, dynamic>))
            .toList(),
      );

  double get totalDistanceKm => totalDistanceM / 1000.0;
}

class StartDeliveryResult {
  final int consignmentId;
  final String status;
  final bool otpSent;
  final String? demoOtp;

  StartDeliveryResult({
    required this.consignmentId,
    required this.status,
    required this.otpSent,
    required this.demoOtp,
  });

  factory StartDeliveryResult.fromJson(Map<String, dynamic> j) => StartDeliveryResult(
        consignmentId: j['consignment_id'] as int,
        status: j['status'] as String? ?? '',
        otpSent: j['otp_sent'] as bool? ?? true,
        demoOtp: j['demo_otp'] as String?,
      );
}

class VerifyOtpResult {
  final bool verified;
  final String status;
  final int? attemptsRemaining;
  final String? detail;

  VerifyOtpResult({
    required this.verified,
    required this.status,
    required this.attemptsRemaining,
    required this.detail,
  });

  factory VerifyOtpResult.fromJson(Map<String, dynamic> j) => VerifyOtpResult(
        verified: j['verified'] as bool? ?? false,
        status: j['status'] as String? ?? '',
        attemptsRemaining: j['attempts_remaining'] as int?,
        detail: j['detail'] as String?,
      );
}

class DeliveryResult {
  final int consignmentId;
  final String status;
  final String? deliveredAt;

  DeliveryResult({
    required this.consignmentId,
    required this.status,
    required this.deliveredAt,
  });

  factory DeliveryResult.fromJson(Map<String, dynamic> j) => DeliveryResult(
        consignmentId: j['consignment_id'] as int,
        status: j['status'] as String? ?? '',
        deliveredAt: j['delivered_at'] as String?,
      );
}
