"""Pytest bootstrap.

Forces tests to run against an isolated, throwaway SQLite database so they can
never touch a real dev/Postgres DB. This must run **before** any ``app`` module
imports settings, which is why it lives in the rootdir conftest.
"""

import os
import tempfile

_tmpdir = tempfile.mkdtemp(prefix="daksync-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmpdir}/test.db"
