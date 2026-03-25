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
        payload = {
            "model": settings.model,
            "prompt": prompt,
            "stream": False,
            "keep_alive": "30m",
            "think": settings.think,
        }
        timeout = httpx.Timeout(connect=5.0, read=300.0, write=30.0, pool=5.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(f"{settings.base_url}/api/generate", json=payload)
            response.raise_for_status()
        data = response.json()
        return OllamaPromptResponse(
            model=settings.model,
            response=data.get("response", ""),
            total_duration=data.get("total_duration"),
            load_duration=data.get("load_duration"),
            prompt_eval_count=data.get("prompt_eval_count"),
            prompt_eval_duration=data.get("prompt_eval_duration"),
            eval_count=data.get("eval_count"),
            eval_duration=data.get("eval_duration"),
        )
