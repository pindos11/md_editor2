from __future__ import annotations

import httpx

from app.models import OllamaPromptResponse, OllamaSettings


class OllamaService:
    async def health(self, settings: OllamaSettings) -> bool:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.base_url}/api/tags")
            response.raise_for_status()
        return True

    async def prompt(self, settings: OllamaSettings, prompt: str) -> OllamaPromptResponse:
        payload = {"model": settings.model, "prompt": prompt, "stream": False}
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{settings.base_url}/api/generate", json=payload)
            response.raise_for_status()
        data = response.json()
        return OllamaPromptResponse(model=settings.model, response=data.get("response", ""))
