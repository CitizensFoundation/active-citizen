"""Main entrypoint for the app."""
from chains.question_analysis import get_question_analysis
from prompts.follow_up_questions_prompt import get_follow_up_questions_prompt
from routers.posts import post_router
from schemas import ChatResponse
from chains.vector_db_chain_chain import get_qa_chain
from callback import FollowupQuestionGenCallbackHandler, StreamingLLMCallbackHandler
from langchain.vectorstores import VectorStore
from schemas import ChatResponse
from fastapi.templating import Jinja2Templates
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
import logging
import pickle
from pathlib import Path
from typing import Optional
from vectorstores.ac_weaviate import AcWeaviate
import weaviate
import traceback
import json
import os
from langchain.callbacks.base import AsyncCallbackManager
import openai
from langchain import PromptTemplate
from langchain.chains.prompt_selector import (
    ConditionalPromptSelector,
    is_chat_model,
)
from langchain.chains import LLMChain
from langchain.chat_models import ChatOpenAI

from prompts.main_system_prompt import main_system_prompt

from langchain.prompts.chat import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
    AIMessagePromptTemplate,
)

from langchain.schema import (
    HumanMessage,
)
vectorstore: Optional[VectorStore] = None
client: Optional[weaviate.Client] = None

client = weaviate.Client("http://localhost:8080")
short_summary_vectorstore = AcWeaviate(
    client, "Posts", "shortSummary", attributes=["group_name"])
full_summary_vectorstore = AcWeaviate(client, "Posts", "fullSummary")
short_summary_with_points_vectorstore = AcWeaviate(
    client, "Posts", "shortSummaryWithPoints")
full_summary_with_points_vectorstore = AcWeaviate(
    client, "Posts", "fullSummaryWithPoints")

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
        self.last_concepts = []
        self.last_group_name = None
        self.websocket = websocket
        self.followup_question_handler = FollowupQuestionGenCallbackHandler(self.websocket)
        self.main_stream_handler = StreamingLLMCallbackHandler(self.websocket)

        self.chat_messages = [
            SystemMessagePromptTemplate.from_template(main_system_prompt),
        ]

        self.qa_chain = get_qa_chain(short_summary_vectorstore, self.followup_question_handler,
                                     self.main_stream_handler, tracing=True)

        followup_question_manager = AsyncCallbackManager([self.followup_question_handler])

        self.followup_question_gen_llm = ChatOpenAI(
            streaming=True,
            temperature=0,
            verbose=True,
            max_tokens=128,
            callback_manager=followup_question_manager,
        )

    def perform_question_analysis(self, question):
        question_analysis = get_question_analysis(question)

        print("----------------------")
        print(question_analysis)

        try:
            # Parse question_analysis into JSON and create a dict object
            conceptsJSON = json.loads(question_analysis)
            question_type = conceptsJSON['question_type']
            concepts = conceptsJSON['concepts']
            group_name = conceptsJSON['neighborhood_name']
        except json.JSONDecodeError:
            # Handle invalid JSON input
            question_type = "asking_about_many_ideas"
            if self.last_concepts and len(self.last_concepts) > 0:
                concepts = self.last_concepts
            else:
                concepts = []

            if self.last_group_name and len(self.last_group_name) > 0:
                group_name = self.last_group_name

            top_k_docs_for_context = 12

        if len(concepts) == 0:
            concepts = self.last_concepts
        else:
            self.last_concepts = concepts

        if group_name == None and self.last_group_name and len(self.last_group_name) > 0:
            group_name = self.last_group_name
        else:
            self.last_group_name = group_name

        # Remove by hand idea, ideas, points for, points against, pros, cons, pro, con from the concepts array
        concepts = [x for x in concepts if x not in ["idea", "ideas", "point for",
                                                        "points for", "point against", "points against", "pro", "pros", "con", "cons"]]

        print(conceptsJSON)
        print(question_type)
        print(concepts)
        print(group_name)
        print("----------------------")

        if question_type == "asking_about_many_ideas":
            self.qa_chain.vectorstore = short_summary_vectorstore
            top_k_docs_for_context = 38
        elif question_type == "asking_about_one_idea":
            self.qa_chain.vectorstore = full_summary_with_points_vectorstore
            top_k_docs_for_context = 8
        elif question_type == "asking_about_points_for_or_against" or "asking_about_pros_or_cons":
            self.qa_chain.vectorstore = short_summary_with_points_vectorstore
            top_k_docs_for_context = 12
        else:
            self.qa_chain.vectorstore = short_summary_vectorstore
            top_k_docs_for_context = 38

        return {
            "question_type": question_type,
            "concepts": concepts,
            "group_name": group_name,
            "top_k_docs_for_context": top_k_docs_for_context
        }

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

            question_analysis = self.perform_question_analysis(question)

            self.chat_messages.append(HumanMessagePromptTemplate.from_template("{question}")),

            start_resp = ChatResponse(sender="bot", message="", type="start")
            await self.websocket.send_json(start_resp.dict())

            result = await self.qa_chain.acall(
                {
                    "question": question,
                    "messages": ChatPromptTemplate.from_messages(self.chat_messages),
                    "question_type": question_analysis["question_type"],
                    "concepts": question_analysis["concepts"],
                    "group_name": question_analysis["group_name"],
                    "top_k_docs_for_context": question_analysis["top_k_docs_for_context"],
                    "chat_history": self.chat_history}
            )

            self.chat_history.append((question, result["answer"]))
            self.chat_messages.append(AIMessagePromptTemplate.from_template(result["answer"])),

            end_resp = ChatResponse(sender="bot", message="", type="end")
            await self.websocket.send_json(end_resp.dict())

            start_resp = ChatResponse(sender="bot", message="", type="start_followup")
            await self.websocket.send_json(start_resp.dict())

            followup_template = get_follow_up_questions_prompt(result["answer"])

            print(f"19191919191919119 - {followup_template}")
            chain = LLMChain(llm=self.followup_question_gen_llm, prompt=followup_template)
            await chain.arun({})

            #await self.followup_question_gen_llm.agenerate(followup_template)

            start_resp = ChatResponse(sender="bot", message="", type="end_followup")
            await self.websocket.send_json(start_resp.dict())

        except WebSocketDisconnect:
            logging.info("websocket disconnect")
        except Exception as e:
            print("JIJIJIJIJ")
            print(traceback.format_exc())
            logging.error(e)
            raise e
