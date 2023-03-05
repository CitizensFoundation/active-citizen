"""Create a ChatVectorDBChain for question/answering."""
from langchain.callbacks.base import AsyncCallbackManager
from langchain.callbacks.tracers import LangChainTracer
from langchain.chains import ChatVectorDBChain
from langchain.chains.chat_vector_db.prompts import (CONDENSE_QUESTION_PROMPT,
                                                     QA_PROMPT)
from langchain.chains.llm import LLMChain
from langchain.chains.question_answering import load_qa_chain
from langchain.llms import OpenAIChat
from langchain.vectorstores.base import VectorStore
from langchain.prompts.prompt import PromptTemplate

prompt_template = """Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.
ALWAYS return a "SOURCES" part in your answer.

{context}
Question: {question}
SOURCES:
Helpful Answer:

"""

QA_PROMPT_WITH_SOURCES = PromptTemplate(
    template=prompt_template, input_variables=["context", "question"]
)


def get_chain(
    vectorstore: VectorStore, question_handler, stream_handler, tracing: bool = False
) -> ChatVectorDBChain:
    """Create a ChatVectorDBChain for question/answering."""
    # Construct a ChatVectorDBChain with a streaming llm for combine docs
    # and a separate, non-streaming llm for question generation
    manager = AsyncCallbackManager([])
    question_manager = AsyncCallbackManager([question_handler])
    stream_manager = AsyncCallbackManager([stream_handler])
    if True or tracing:
        tracer = LangChainTracer()
        tracer.load_default_session()
        manager.add_handler(tracer)
        question_manager.add_handler(tracer)
        stream_manager.add_handler(tracer)

    question_gen_llm = OpenAIChat(
        temperature=0.2,
        verbose=True,
        max_tokens=1000,
        model="gpt-3.5-turbo",
        callback_manager=question_manager,
    )
    streaming_llm = OpenAIChat(
        streaming=True,
        callback_manager=stream_manager,
        model="gpt-3.5-turbo",
        max_tokens=1000,
        verbose=True,
        temperature=0.2,
    )

    print(CONDENSE_QUESTION_PROMPT)
    print()
    print(QA_PROMPT)

    question_generator = LLMChain(
        llm=question_gen_llm, prompt=CONDENSE_QUESTION_PROMPT, callback_manager=manager
    )
    doc_chain = load_qa_chain(
        streaming_llm, chain_type="stuff", prompt=QA_PROMPT_WITH_SOURCES, callback_manager=manager
    )

    qa = ChatVectorDBChain(
        vectorstore=vectorstore,
        combine_docs_chain=doc_chain,
        question_generator=question_generator,
        callback_manager=manager,
        top_k_docs_for_context=15,
        verbose=True,
        tracing=True
    )

    return qa
