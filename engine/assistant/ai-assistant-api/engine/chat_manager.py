"""Main entrypoint for the app."""
from engine.question_analysis import get_question_analysis
from routers.posts import post_router
from schemas import ChatResponse
from chains.vector_db_chain_chain import get_qa_chain
from callback import QuestionGenCallbackHandler, StreamingLLMCallbackHandler
from langchain.vectorstores.weaviate import Weaviate
from langchain.vectorstores import VectorStore
from callback import QuestionGenCallbackHandler, StreamingLLMCallbackHandler
from schemas import ChatResponse
from fastapi.templating import Jinja2Templates
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
import logging
import pickle
from pathlib import Path
from typing import Optional
import weaviate
import traceback
import json
import os
import openai

from langchain.schema import (
    HumanMessage,
)
vectorstore: Optional[VectorStore] = None
client: Optional[weaviate.Client] = None

client = weaviate.Client("http://localhost:8080")
vectorstore = Weaviate(client, "Posts", "fullSummaryWithPoints")
nearText = {"concepts": ["Klambratún", "playground"]}

result = (
    client.query
    .get("Posts", ["fullSummaryWithPoints"])
    .with_near_text(nearText)
    .with_limit(15)
    .do()
)

print(json.dumps(result, indent=4))

states = {
    "waiting": {
        "start": "thinking"
    },
    "thinking": {
        "end": "responding"
    },
    "responding": {
        "reset": "waiting"
    }
}

class ChatManager:
    def __init__(self, websocket):
        self.chat_history = []
        self.websocket = websocket
        self.question_handler = QuestionGenCallbackHandler(self.websocket)
        self.stream_handler = StreamingLLMCallbackHandler(self.websocket)
        print(1)
        self.qa_chain = get_qa_chain(vectorstore, self.question_handler,
                                  self.stream_handler, tracing=True)

    async def get_concepts_and_refined_question(self, question):

        return result["concepts"], result["answer"]

    async def chat_loop(self):
        try:
            # Receive and send back the client message
            question = await self.websocket.receive_text()
            resp = ChatResponse(sender="you", message=question, type="stream")
            await self.websocket.send_json(resp.dict())

            # Construct a response
            resp = ChatResponse(sender="bot", message="", type="thinking")
            await self.websocket.send_json(resp.dict())

            question_analysis = get_question_analysis(question)

            try:
                # Parse question_analysis into JSON and create a dict object
                conceptsJSON = json.loads(question_analysis)
                question_type = conceptsJSON['question_type']
                concepts = conceptsJSON['concepts']
            except json.JSONDecodeError:
                # Handle invalid JSON input
                question_type = None
                concepts = None

            print("----------------------")
            print(conceptsJSON)
            print(question_type)
            print(concepts)
            print("----------------------")


            # Construct a response
            start_resp = ChatResponse(sender="bot", message="", type="start")
            await self.websocket.send_json(start_resp.dict())

            result = await self.qa_chain.acall(
                 {
                     "question": question,
                     "question_type": question_type,
                     "concepts": concepts,
                     "chat_history": self.chat_history}
            )

            self.chat_history.append((question, result["answer"]))

            end_resp = ChatResponse(sender="bot", message="", type="end")
            await self.websocket.send_json(end_resp.dict())
        except WebSocketDisconnect:
            logging.info("websocket disconnect")
        except Exception as e:
            print("JIJIJIJIJ")
            print(traceback.format_exc())
            logging.error(e)
            raise e
