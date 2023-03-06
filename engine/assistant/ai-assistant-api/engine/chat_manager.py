"""Main entrypoint for the app."""
from routers.posts import post_router
from schemas import ChatResponse
from chat_chain import get_chain
from callback import QuestionGenCallbackHandler, StreamingLLMCallbackHandler
from langchain.vectorstores.weaviate import Weaviate
from langchain.vectorstores import VectorStore
from fastapi.templating import Jinja2Templates
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
import logging
import pickle
from pathlib import Path
from typing import Optional
import weaviate
import json
import os
os.environ["LANGCHAIN_HANDLER"] = "langchain"


vectorstore: Optional[VectorStore] = None
client: Optional[weaviate.Client] = None

client = weaviate.Client("http://localhost:8080")
vectorstore = Weaviate(client, "Posts", "shortSummaryWithPoints")
nearText = {"concepts": ["Klambratún", "playground"]}

result = (
    client.query
    .get("Posts", ["shortSummaryWithPoints"])
    .with_near_text(nearText)
    .with_limit(15)
    .do()
)

print(json.dumps(result, indent=4))

class ChatManager:
    def __init__(self, websocket):
        self.chat_history = []
        self.websocket = websocket
        self.question_handler = QuestionGenCallbackHandler(self.websocket)
        self.stream_handler = StreamingLLMCallbackHandler(self.websocket)
        self.qa_chain = get_chain(vectorstore, self.question_handler,
                                  self.stream_handler, tracing=True)

    async def chat_loop(self):
        try:
            # Receive and send back the client message
            question = await self.websocket.receive_text()
            resp = ChatResponse(sender="you", message=question, type="stream")
            await self.websocket.send_json(resp.dict())

            # Construct a response
            start_resp = ChatResponse(sender="bot", message="", type="start")
            await self.websocket.send_json(start_resp.dict())

            result = await self.qa_chain.acall(
                {"question": question, "chat_history": self.chat_history}
            )
            self.chat_history.append((question, result["answer"]))

            end_resp = ChatResponse(sender="bot", message="", type="end")
            await self.websocket.send_json(end_resp.dict())
        except WebSocketDisconnect:
            logging.info("websocket disconnect")
        except Exception as e:
            logging.error(e)
            raise e
