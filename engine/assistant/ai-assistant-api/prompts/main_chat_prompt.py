from langchain import PromptTemplate
from langchain.chains.prompt_selector import (
    ConditionalPromptSelector,
    is_chat_model,
)
from langchain.prompts.chat import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
)

prompt_template = """
Always be polite, positive and helpful.
When a user ask for an image or images always write them out in the image in the markdown inline image format.
When the user asks for a list of ideas show at most 10 ideas in a list and then say: \n\nAnd more...
If a user asks for a price estimate only offer prices ranges, low, medium, high.
Use the following pieces of context to answer the users question about ideas in the My Neighborhood participatory budgeting project.
There are a total of 1710 ideas in the project in 10 neighrborhoods and you can have access to a complete list of them in your context depending on what the user searches for.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
ALWAYS return all the sources as a part of your answer from the Source: line
Use the following pieces of context to answer the users question.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
Never make up your own ideas. If the idea is not in the context just leave it out.
----------------
{context}
"""

custom_prompt = PromptTemplate(
    input_variables=["context"],
    template=prompt_template,
)

messages = [
    SystemMessagePromptTemplate.from_template(prompt_template),
    HumanMessagePromptTemplate.from_template("{question}"),
]

MAIN_CHAT_PROMPT = ChatPromptTemplate.from_messages(messages)
