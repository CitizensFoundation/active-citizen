"""Main entrypoint for the app."""
import logging
import pickle
from pathlib import Path
from typing import Optional
from engine.chat_manager import ChatManager
import weaviate
import json
import os
os.environ["LANGCHAIN_HANDLER"] = "langchain"

logging.basicConfig(level=logging.DEBUG)

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.templating import Jinja2Templates
from langchain.vectorstores import VectorStore
from langchain.vectorstores.weaviate import Weaviate

from callback import QuestionGenCallbackHandler, StreamingLLMCallbackHandler
from chains.vector_db_chain_chain import get_qa_chain
from schemas import ChatResponse

from routers.posts import post_router

app = FastAPI()
templates = Jinja2Templates(directory="templates")
vectorstore: Optional[VectorStore] = None
client: Optional[weaviate.Client] = None

client = weaviate.Client("http://localhost:8080")
vectorstore = Weaviate(client, "Posts", "shortName")
nearText = {"concepts": ["children","playground"], "distance": 0.25}

result = (
    client.query
    .get("Posts", ["shortName"])
    .with_near_text(nearText)
    .with_limit(15)
    .do()
)

print(json.dumps(result, indent=4))

app.include_router(post_router)

@app.on_event("startup")
async def startup_event():
    logging.info("loading vectorstore")

@app.get("/")
async def get(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.websocket("/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    chat_manager = ChatManager(websocket)

    while True:
        try:
           await chat_manager.chat_loop()
        except WebSocketDisconnect:
            logging.info("websocket disconnect")
            break
        except Exception as e:
            logging.error(e)
            resp = ChatResponse(
                sender="bot",
                message="Sorry, something went wrong. Try again.",
                type="error",
            )
            await websocket.send_json(resp.dict())


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=9000, debug=True, log_level="debug")
