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
    Generate three very brief follow-up questions that the user would likely ask next about their healthcare plan and employee handbook.
    Use double angle brackets to reference the questions, e.g. <<Are there exclusions for prescriptions?>>.
    Try not to repeat questions that have already been asked.
    Only generate questions and do not generate any text before or after the questions, such as 'Next Questions'"""

follup_up_questions_prompt = PromptTemplate(
    template=followup_questions_prompt_template,
)

def get_follow_up_questions_prompt(last_ai_answer):

    messages = [
        SystemMessagePromptTemplate.from_template("""
    You are an accoplished computirzed followup question generator. \
    You always create the best followup questions that are short and important in the context of \
    participotry budgeting idea generation projects."
    """),
        AIMessagePromptTemplate.from_template(last_ai_answer),
        HumanMessagePromptTemplate.from_template(followup_questions_prompt_template),
    ]

    return ChatPromptTemplate.from_messages(messages)
