/// Thin REST client for the DAKSYNC backend. Holds the bearer token after login
/// and exposes exactly the endpoints the postman flow needs (see
/// docs/API_CONTRACT.md).
library;

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config.dart';
import '../models/models.dart';

/// Raised for any non-2xx response; [message] carries the backend `detail`.
class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);
  @override
  String toString() => message;
}

class ApiClient {
  String? _token;

  void setToken(String? token) => _token = token;
  bool get isAuthenticated => _token != null;

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$kApiBase$kApiPrefix$path').replace(queryParameters: query);

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  dynamic _decode(http.Response res) {
    final body = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode >= 200 && res.statusCode < 300) return body;
    String detail = 'Request failed (${res.statusCode})';
    if (body is Map && body['detail'] != null) {
      final d = body['detail'];
      detail = d is String ? d : d.toString();
    }
    throw ApiException(res.statusCode, detail);
  }

  // --- Auth ---------------------------------------------------------------
  Future<LoginResult> login(String email, String password) async {
    final res = await http.post(
      _uri('/auth/login'),
      headers: _headers,
      body: jsonEncode({'email': email, 'password': password}),
    );
    final result = LoginResult.fromJson(_decode(res) as Map<String, dynamic>);
    _token = result.accessToken;
    return result;
  }

  // --- Routes -------------------------------------------------------------
  Future<List<DeliveryRoute>> listRoutes() async {
    final res = await http.get(_uri('/routes'), headers: _headers);
    final data = _decode(res) as List<dynamic>;
    return data.map((r) => DeliveryRoute.fromJson(r as Map<String, dynamic>)).toList();
  }

  Future<DeliveryRoute> getRoute(int routeId) async {
    final res = await http.get(_uri('/routes/$routeId'), headers: _headers);
    return DeliveryRoute.fromJson(_decode(res) as Map<String, dynamic>);
  }

  // --- Delivery lifecycle -------------------------------------------------
  Future<StartDeliveryResult> startDelivery(int consignmentId) async {
    final res = await http.post(_uri('/deliveries/start/$consignmentId'), headers: _headers);
    return StartDeliveryResult.fromJson(_decode(res) as Map<String, dynamic>);
  }

  Future<VerifyOtpResult> verifyOtp(int consignmentId, String code) async {
    final res = await http.post(
      _uri('/deliveries/verify-otp'),
      headers: _headers,
      body: jsonEncode({'consignment_id': consignmentId, 'code': code}),
    );
    return VerifyOtpResult.fromJson(_decode(res) as Map<String, dynamic>);
  }

  Future<DeliveryResult> completeDelivery(int consignmentId) async {
    final res = await http.post(
      _uri('/deliveries/complete'),
      headers: _headers,
      body: jsonEncode({'consignment_id': consignmentId}),
    );
    return DeliveryResult.fromJson(_decode(res) as Map<String, dynamic>);
  }

  Future<DeliveryResult> failDelivery(int consignmentId, String reason, String? notes) async {
    final res = await http.post(
      _uri('/deliveries/fail'),
      headers: _headers,
      body: jsonEncode({
        'consignment_id': consignmentId,
        'reason': reason,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      }),
    );
    return DeliveryResult.fromJson(_decode(res) as Map<String, dynamic>);
  }
}
