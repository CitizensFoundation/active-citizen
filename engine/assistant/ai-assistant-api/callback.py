"""Callback handlers used in the app."""
from typing import Any, Dict, List

from langchain.callbacks.base import CallbackManager

from schemas import ChatResponse


class StreamingLLMCallbackHandler(CallbackManager):
    """Callback handler for streaming LLM responses."""

    def __init__(self, websocket):
        self.websocket = websocket

    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        resp = ChatResponse(sender="bot", message=token, type="stream")
        await self.websocket.send_json(resp.dict())

class FollowupQuestionGenCallbackHandler(CallbackManager):
    """Callback handler for question generation."""

    def __init__(self, websocket):
        self.websocket = websocket

    async def on_llm_new_token(self, token: str, **kwargs: Any) -> None:
        resp = ChatResponse(sender="bot", message=token, type="stream_followup")
        print(token)
        await self.websocket.send_json(resp.dict())
