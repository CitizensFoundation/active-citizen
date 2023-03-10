from chains.chat_chain import ChatChainWithSources
from langchain.callbacks.base import AsyncCallbackManager
from langchain.callbacks.tracers import LangChainTracer
from langchain.chains import ChatVectorDBChain
from langchain.chains.chat_vector_db.prompts import CONDENSE_QUESTION_PROMPT
from langchain.chains.question_answering.stuff_prompt import PROMPT_SELECTOR
from langchain.chains.llm import LLMChain
from langchain.chains.question_answering import load_qa_chain
from langchain.chat_models import ChatOpenAI
from langchain.vectorstores.base import VectorStore
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
There are a total of 1710 ideas in the project.
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

CHAT_PROMPT = ChatPromptTemplate.from_messages(messages)

def get_qa_chain(
    vectorstore: VectorStore, question_handler, stream_handler, tracing: bool = False
) -> ChatVectorDBChain:
    """Create a ChatVectorDBChain for question/answering."""
    # Construct a ChatVectorDBChain with a streaming llm for combine docs
    # and a separate, non-streaming llm for question generation
    manager = AsyncCallbackManager([])
    question_manager = AsyncCallbackManager([question_handler])
    stream_manager = AsyncCallbackManager([stream_handler])
    if tracing:
        tracer = LangChainTracer()
        tracer.load_default_session()
        manager.add_handler(tracer)
        question_manager.add_handler(tracer)
        stream_manager.add_handler(tracer)

    question_gen_llm = ChatOpenAI(
        temperature=0,
        verbose=True,
        max_tokens=1200,
        callback_manager=question_manager,
    )

    streaming_llm = ChatOpenAI(
        streaming=True,
        callback_manager=stream_manager,
        verbose=True,
        max_tokens=1000,
        temperature=0,
    )

    question_generator = LLMChain(
        llm=question_gen_llm, prompt=CONDENSE_QUESTION_PROMPT, callback_manager=manager
    )
    qa_prompt = PROMPT_SELECTOR.get_prompt(streaming_llm)

    print(CHAT_PROMPT)

    doc_chain = load_qa_chain(
        streaming_llm, chain_type="stuff", prompt=CHAT_PROMPT, callback_manager=manager
    )

    qa = ChatChainWithSources(
        vectorstore=vectorstore,
        combine_docs_chain=doc_chain,
        question_generator=question_generator,
        top_k_docs_for_context=12,
        callback_manager=manager,
    )
    return qa
