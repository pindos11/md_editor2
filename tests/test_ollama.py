import asyncio

import httpx
import pytest

from app.models import OllamaSettings
from app.services.ollama import OllamaService


def test_prompt_returns_model_response(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_post(self, url: str, json: dict) -> httpx.Response:
        request = httpx.Request("POST", url, json=json)
        return httpx.Response(200, request=request, json={"response": "hello"})

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    service = OllamaService()
    response = asyncio.run(service.prompt(OllamaSettings(), "hello"))
    assert response.response == "hello"
