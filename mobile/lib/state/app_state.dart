/// App-wide state (provider). Holds the authenticated postman + token and the
/// current list of routes, and brokers all API calls through a single client.
library;

import 'package:flutter/foundation.dart';

import '../models/models.dart';
import '../services/api_client.dart';

class AppState extends ChangeNotifier {
  final ApiClient api = ApiClient();

  AuthUser? _user;
  bool _loading = false;
  String? _error;
  List<DeliveryRoute> _routes = [];

  AuthUser? get user => _user;
  bool get loading => _loading;
  String? get error => _error;
  bool get isAuthenticated => _user != null;
  List<DeliveryRoute> get routes => _routes;

  void _setLoading(bool v) {
    _loading = v;
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _setLoading(true);
    _error = null;
    try {
      final result = await api.login(email.trim(), password);
      _user = result.user;
      _setLoading(false);
      return true;
    } on ApiException catch (e) {
      _error = e.message;
      _setLoading(false);
      return false;
    } catch (e) {
      _error = 'Could not reach the server. Is the backend running?';
      _setLoading(false);
      return false;
    }
  }

  void logout() {
    _user = null;
    _routes = [];
    api.setToken(null);
    notifyListeners();
  }

  Future<void> refreshRoutes() async {
    _setLoading(true);
    _error = null;
    try {
      _routes = await api.listRoutes();
    } on ApiException catch (e) {
      _error = e.message;
    } catch (e) {
      _error = 'Could not load routes.';
    }
    _setLoading(false);
  }
}
