import openai
from prompts.refine_question_prompt import get_refine_question_prompt

def get_question_analysis(original_question, max_tokens=1000):
    refine_question_and_concept = """Please return the following fields in JSON format:
- "concepts" An array of the core concepts from the text.
- "original_question" The original question.
- "question_type": Can be one of: \
"asking_about_one_idea, "asking_about_many_ideas", \
"asking_about_points_for_or_against", "asking_about_pros_or_cons"
- "neightborhood_name: Can be nothing or Actual neighborhood names: \
"Vesturbær", "Laugardalur", "Hlíðar", "Grafarvogur (og Bryggjuhverfi)", "Háaleiti og Bústaðir", \
"Árbær (og Norðlingaholt)", "Norðlingaholt", "Breiðholt", "Miðborg", "Grafarholt og Úlfarsárdalur" \
"Kjalarnes" or variations on those name like "Vesturbæ" or "Háaleiti" or "Ábær" or "Bryggjuhverfi".
If there is a variation of neighborhood name then use the \
Actual neightborhood name for the neightborhood_name JSON field.
Never list "idea","ideas", "points for/against" or neighborhood names in the "concepts" JSON.
Never return any Note: or comments after the JSON_ANSWER,
Never return more than one JSON_ANSWER per question and always stop after you have provided the answer.

    Question: Are there any ideas connected to dogs and fun?

    JSON_ANSWER:
    {
        "question": "Are there any ideas connected to dogs and fun?",
        "question_type": "asking_about_many_ideas",
        "neightborhood_name": null,
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
        "neightborhood_name": null,
        "concepts": [
            "dog"
        ]
    }

    Original question: Tell me more about that playground idea in Vesturbær

    JSON_ANSWER:
    {
        "question": "Tell me more about that playground idea in Vesturbær",
        "question_type": "asking_about_one_idea",
        "neightborhood_name": "Vesturbær",
        "concepts": [
            "playground"
        ]
    }

    Original question: {original_question}

    JSON_ANSWER:
        """

    # Replace the text "{original_question}" with the original_question in refine_question_and_concept
    refine_question_and_concept = refine_question_and_concept.replace("{original_question}", original_question)

    completion = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        temperature=0.2,
        messages=[
            {"role": "system", "content": "You are a very smart and capable computer system that produces highly detailed and accurate JSON_ANSWERs from questions."},
            {"role": "user", "content": f"{refine_question_and_concept}"}
        ]
    )

    #completion = openai.ChatCompletion.create(
    #    model="gpt-3.5-turbo",
    #    temperature=0.2,
    #    messages=get_refine_question_prompt(original_question)
    #)

    return completion.choices[0].message.content
