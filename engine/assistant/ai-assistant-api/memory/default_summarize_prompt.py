from langchain import PromptTemplate
from langchain.chains.prompt_selector import (
    ConditionalPromptSelector,
    is_chat_model,
)
from langchain.prompts.chat import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    AIMessagePromptTemplate,
    HumanMessagePromptTemplate,
)

default_system_template = """Your are an advanced text summarizer, \
the best in the business and you never make mistakes. You think things through."""

default_chat_summary_template = """Please summarize the chat message below, keep the summary very short and relevant to the chat history. \
Make sure all entities are mentioned in the summary.

Chat history:
{chat_history}

Is the summary for user or chatbot: {user_or_chatbot}

Chat message to summarize: {chat_message}
"""

default_chat_summary_prompt = PromptTemplate(
    template=default_chat_summary_template,
    input_variables=["chat_history", "user_or_chatbot", "chat_message"],
)


def get_chat_summary_prompt(
        chat_message,
        chat_history,
        user_or_chatbot,
        summary_prompt=default_chat_summary_prompt,
        system_template=default_system_template):

    messages = [
        SystemMessagePromptTemplate.from_template(system_template),
        HumanMessagePromptTemplate.from_template(summary_prompt.format(
            chat_history=chat_history,
            user_or_chatbot=user_or_chatbot,
            chat_message=chat_message
        )
        ),
    ]

    return ChatPromptTemplate.from_messages(messages)
