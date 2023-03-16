from abc import ABC
from typing import Any, Dict, List, Optional

from memory.default_refined_history_prompt import refine_and_get_chat_history_prompt
from langchain.llms import OpenAI
from memory.default_summarize_prompt import get_chat_summary_prompt
from pydantic import BaseModel, Field
import asyncio

from langchain.memory.utils import get_prompt_input_key
from langchain.schema import AIMessage, BaseMemory, BaseMessage, HumanMessage

from langchain.prompts.chat import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    AIMessagePromptTemplate,
    HumanMessagePromptTemplate,
)

from langchain.memory.chat_memory import BaseChatMemory, ChatMessageHistory

from langchain.llms import OpenAI


class DynamicChatMemory(BaseChatMemory):
    custom_summarize_prompt: ChatPromptTemplate = None
    custom_refined_history_prompt: ChatPromptTemplate = None
    full_chats_length = 1
    summarized_chats_length = 2
    latest_refined_user_chat_history: str = ""
    latest_refined_chatbot_chat_history: str = ""

    llm = OpenAI(
        temperature=0.2,
        max_tokens=128
    )

    def memory_pair_count(self):
        length = len(self.chat_memory.messages)-1
        return length/2

    def memory_variables(self) -> List[str]:
        """Will always return list of memory variables.

        :meta private:
        """
        return ["entities", self.chat_history_key]

    def load_memory_variables(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Return history buffer."""

    async def generate_summary(self, chatbot_or_user, chat_message):
        await self.llm.agenerate(
            get_chat_summary_prompt(
                self.chat_memory,
                chatbot_or_user,
                chat_message,
                self.custom_summarize_prompt
            )
        )

    async def generate_refined_history(self, current_brief_chat_history, chatbot_or_user, chat_message):
        await self.llm.agenerate(
            refine_and_get_chat_history_prompt(
                current_brief_chat_history,
                self.chat_memory,
                chatbot_or_user,
                chat_message,
                self.custom_refined_history_prompt
            )
        )

    async def process_memory(self):
        if self.memory_pair_count() > self.full_chats_length:
            await self.async_summarize_last_messages()

    async def async_summarize_last_messages(self):
        last_user_message = self.chat_memory.messages[-2]
        last_bot_message = self.chat_memory.messages[-1]

        tasks = [
            self.generate_summary("chatbot",last_bot_message),
            self.generate_summary("user",last_user_message),
        ]

        if self.memory_pair_count() > self.summarized_chats_length+self.full_chats_length:
            tasks.extend([
                self.generate_refined_history(self.latest_refined_user_chat_history, "user",last_user_message),
                self.generate_refined_history(self.latest_refined_chatbot_chat_history, "chatbot",last_bot_message)
            ])

        results = await asyncio.gather(*tasks)

        self.chat_memory.messages[-2] = results[0].generations[0][0].text
        self.chat_memory.messages[-1] = results[1].generations[0][0].text

        if self.memory_pair_count() > self.summarized_chats_length+self.full_chats_length:
            self.latest_refined_chatbot_chat_history = results[2][0].generations[0][0].text
            self.latest_refined_user_chat_history = results[3][0].generations[0][0].text
            self.chat_memory.messages = self.chat_memory.messages[:-2]

    def add_system_message(self, message: str) -> None:
        self.chat_memory.messages.append(message)

    def save_context(self, inputs: Dict[str, Any], outputs: Dict[str, str]) -> None:
        self.chat_memory.add_user_message(inputs["input"])
        self.chat_memory.add_ai_message(outputs["output"])
