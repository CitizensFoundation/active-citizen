from langchain.prompts.chat import (
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
)
from langchain import PromptTemplate

refine_question_prompt_template = """Please return the following fields in json format:
- "concepts" An awway of the core concepts from the text
- "original_question" The original question
- "question_type": Can be one of "asking_about_one_idea, "asking_about_many_ideas", "asking_about_points_for_or_against", "asking_about_pros_or_cons"
Never list "idea","ideas", "points for/against", in the "concepts" JSON.
Never return any Note: or comments after the JSON_ANSWER
Never return more than one JSON_ANSWER per question and always stop after you have provided the one JSON_ANSWER.
    Question: Are there any ideas connected to dogs and fun?

    JSON_ANSWER:
    {
        "question": "Are there any ideas connected to dogs and fun?",
        "question_type": "asking_about_many_ideas",
        "concepts": [
            "dogs",
            "fun"
        ]
    }

    Original question: Is there an idea about a dog? If so give me the best points for and against the idea.

    JSON_ANSWER:
    {
        "question": "Is there an idea about a dog? If so give me the best points for and against the idea.",
        "question_type": "asking_about_points_for_or_against",
        "concepts": [
            "dog"
        ]
    }

    Original question: Tell me more about that playground idea in Vesturbær

    JSON_ANSWER:
    {
        "question": "Tell me more about that playground idea in Vesturbær",
        "question_type": "asking_about_one_idea",
        "concepts": [
            "playground",
            "Vesturbær"
        ]
    }

    Original question: {original_question}

    JSON_ANSWER:
        """

def get_refine_question_prompt(original_question):
    custom_prompt = PromptTemplate(
        input_variables=["original_question"],
        template=refine_question_prompt_template,
    )

    messages = [
        SystemMessagePromptTemplate.from_template(""),
        HumanMessagePromptTemplate.from_template(custom_prompt),
    ]

    return ChatPromptTemplate.from_messages(messages).format(original_question=original_question)

