import asyncio

import httpx
import pytest

from app.models import OllamaSettings
from app.services.ollama import OllamaService


def test_prompt_returns_model_response(monkeypatch: pytest.MonkeyPatch) -> None:
    captured_json = {}

    async def fake_post(self, url: str, json: dict) -> httpx.Response:
        captured_json.update(json)
        request = httpx.Request("POST", url, json=json)
        return httpx.Response(200, request=request, json={"response": "hello", "load_duration": 123})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    service = OllamaService()
    response = asyncio.run(service.prompt(OllamaSettings(), "hello"))
    assert response.response == "hello"
    assert response.load_duration == 123
    assert captured_json["keep_alive"] == "30m"
    assert captured_json["think"] is False


def test_prompt_uses_extended_read_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    captured_timeout = {}

    class FakeClient:
        def __init__(self, *args, timeout=None, **kwargs):
            captured_timeout["timeout"] = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url: str, json: dict) -> httpx.Response:
            request = httpx.Request("POST", url, json=json)
            return httpx.Response(200, request=request, json={"response": "hello"})

    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    service = OllamaService()

    response = asyncio.run(service.prompt(OllamaSettings(), "hello"))

    assert response.response == "hello"
    timeout = captured_timeout["timeout"]
    assert isinstance(timeout, httpx.Timeout)
    assert timeout.read == 300.0
