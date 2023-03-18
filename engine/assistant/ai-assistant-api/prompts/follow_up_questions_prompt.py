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
    Generate three very brief follow-up questions from your previous answer, something the user would likely ask about the ideas in the Hverfið mitt participatory budgeting project.
    Use double angle brackets to reference the questions, e.g. <<Are the ideas about cats?>> or <<Tell me more about the dog park idea>>.
    Try not to repeat questions that have already been asked.
    Keep the follow-up question generated very short, at the most 5 to 8 words.
    Never output more than 8 words per each follow-up question.
    Make sure that at least one of the generated follow-up questions is about different types of ideas, like for kids, schools, animals, playgrounds, art, music, etc
    Also make sure at least one of the generated follow-up questions is releated to your previous answer.
    Never generate follow-up questions asking about estimated costs or asking for images.
    Only generate questions and do not generate any text before or after the questions, such as 'Next Questions'"""

follup_up_questions_prompt = PromptTemplate(
    template=followup_questions_prompt_template,
    input_variables=[],
)

def get_follow_up_questions_prompt(last_question,last_ai_answer):

    messages = [
        SystemMessagePromptTemplate.from_template("""
    You are an accomplished follow-up question generator. \
    You always create the best follow-up questions that are very short and important in the context of \
    participatory budgeting idea generation projects."
    """),
        HumanMessagePromptTemplate.from_template(f"{last_question}"),
        AIMessagePromptTemplate.from_template(f"{last_ai_answer}"),
        HumanMessagePromptTemplate.from_template(followup_questions_prompt_template),
    ]

    return ChatPromptTemplate.from_messages(messages)
