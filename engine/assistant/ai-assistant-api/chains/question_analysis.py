import openai

def get_question_analysis(original_question, max_tokens=1000):
    refine_question_and_concept = """
You are a JSON creator for the My Neighborhood participatory budgeting project and \
you create JSON_ANSWERs from user questions about the project.
Please return the following fields in JSON format:
- "concepts" An array of the core concepts from the text.
- "original_question" The original question.
- "question_type": Can be one of: \
"asking_about_one_idea", "asking_about_many_ideas", \
"asking_about_points_for_or_against", "asking_about_pros_or_cons", "asking_about_the_project_rules_and_overall_organization_of_the_project",
- "summarization_type": Can be one of: \
"not_asking_for_summarization", "summarize_many_ideas", \
"summarize_pros_and_cons"
- "neighborhood_name: Can be nothing or Actual neighborhood names: \
"Vesturbær", "Laugardalur", "Hlíðar", "Grafarvogur (og Bryggjuhverfi)", "Háaleiti og Bústaðir", \
"Árbær (og Norðlingaholt)", "Norðlingaholt", "Breiðholt", "Miðborg", "Grafarholt og Úlfarsárdalur" \
"Kjalarnes" or variations on those name like "Vesturbæ" or "Háaleiti" or "Ábær" or "Bryggjuhverfi".
If there is a variation of neighborhood name then use the \
Actual neightborhood name for the neighborhood_name JSON field.
If the is asking about the most popular idea, the most unique idea or the most controversial idea \
then make sure to use "asking_about_many_ideas" for the question_type JSON field.
Make sure to never use "asking_about_the_project_rules_and_overall_organization_of_the_project" for "question_type" JSON field except \
if the question is about specifici ideas or groups of ideas.
The "concepts" JSON array should only include entities, and never include: "idea","ideas", "points for", \
"points against", "idea number 1", neighborhood names or anything like that, just leave the "concepts" array empty instead.
Never return any Note: or comments after the JSON_ANSWER,
Never return more than one JSON_ANSWER per question and always stop after you have provided the answer.

    Question: Are there any ideas connected to dogs and fun?

    JSON_ANSWER:
    {
        "question": "Are there any ideas connected to dogs and fun?",
        "question_type": "asking_about_many_ideas",
        "summarization_type": "not_asking_for_summarization",
        "neighborhood_name": null,
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
        "summarization_type": "summarize_pros_and_cons",
        "neighborhood_name": null,
        "concepts": [
            "dog"
        ]
    }

    Original question: Tell me more about that playground idea in Vesturbær

    JSON_ANSWER:
    {
        "question": "Tell me more about that playground idea in Vesturbær",
        "question_type": "asking_about_one_idea",
        "summarization_type": "not_asking_for_summarization",
        "neighborhood_name": "Vesturbær",
        "concepts": [
            "playground"
        ]
    }

    JSON_ANSWER:
    {
        "question": "What are the main themes of all ideas",
        "question_type": "asking_about_many_ideas",
        "summarization_type": "summarize_many_ideas",
        "neighborhood_name": null,
        "concepts": []
    }

    Original question: {original_question}

    JSON_ANSWER:
        """

    # Replace the text "{original_question}" with the original_question in refine_question_and_concept
    refine_question_and_concept = refine_question_and_concept.replace("{original_question}", original_question)

    completion = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        temperature=0.2,
        max_tokens=128,
        messages=[
            {"role": "system", "content": "You are a very smart and capable computer system that produces highly detailed and accurate JSON_ANSWERs from questions. If you don't know the answer, leave an empty JSON_ANSWER."},
            {"role": "user", "content": f"{refine_question_and_concept}"}
        ]
    )

    #completion = openai.ChatCompletion.create(
    #    model="gpt-3.5-turbo",
    #    temperature=0.2,
    #    messages=get_refine_question_prompt(original_question)
    #)

    return completion.choices[0].message.content
