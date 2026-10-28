import pytest
from fastapi.testclient import TestClient
from api.app import app

def test_api_health():
    client = TestClient(app)
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "service": "nguech_ngoac_core_api"}

def test_api_list_projects():
    client = TestClient(app)
    resp = client.get("/api/projects")
    assert resp.status_code == 200
    data = resp.json()
    assert "projects" in data
    # sample_project should be listed
    names = [p["name"] for p in data["projects"]]
    assert "sample_project" in names

def test_api_env():
    client = TestClient(app)
    resp = client.get("/api/env")
    assert resp.status_code == 200
    data = resp.json()
    assert "os" in data
    assert "ffmpeg" in data
    assert data["ffmpeg"]["installed"] is True
