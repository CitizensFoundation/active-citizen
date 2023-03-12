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

followup_questions_prompt_template = """
    Generate three very brief follow-up questions from your last answer, something the user would likely ask about the ideas in the My Neighborhood participatory budgeting project.
    Use double angle brackets to reference the questions, e.g. <<Are the ideas about cats?>>.
    Try not to repeat questions that have already been asked.
    Keep the questions very short.
    Only ask about ideas that could be in the project not about the project itself.
    Only generate questions and do not generate any text before or after the questions, such as 'Next Questions'"""

follup_up_questions_prompt = PromptTemplate(
    template=followup_questions_prompt_template,
    input_variables=[],
)

def get_follow_up_questions_prompt(last_question,last_ai_answer):

    messages = [
        SystemMessagePromptTemplate.from_template("""
    You are an accomplished followup question generator. \
    You always create the best followup questions that are very short and important in the context of \
    participatory budgeting idea generation projects."
    """),
        HumanMessagePromptTemplate.from_template(f"{last_question}"),
        AIMessagePromptTemplate.from_template(f"{last_ai_answer}"),
        HumanMessagePromptTemplate.from_template(followup_questions_prompt_template),
    ]

    return ChatPromptTemplate.from_messages(messages)
