import openai

def get_question_analysis(original_question, max_tokens=1000):
    refine_question_and_concept = """Please return the following fields in json format:
- "concepts" An awway of the core concepts from the text
- "original_question" The original question
- "question_type": Can be one of "asking_about_one_idea, "asking_about_many_ideas", "asking_about_points_for_or_against"
Never list "idea","ideas", "points for/against", in the "concepts" JSON.

    Question: Are there any ideas connected to dogs and fun?

    JSON_ANSWER: {
        "question": "Are there any ideas connected to dogs and fun?",
        "question_type": "asking_about_many_ideas",
        "concepts": [
            "dogs",
            "fun"
        ]
    }

    Original question: Is there an idea about a dog? If so give me the best points for and against the idea.

    JSON_ANSWER: {
        "question": "Is there an idea about a dog? If so give me the best points for and against the idea.",
        "question_type": "asking_about_points_for_or_against",
        "concepts": [
            "dog"
        ]
    }

    Original question: Tell me more about that playground idea in Vesturbær

    JSON_ANSWER: {
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

    # Replace the text "{original_question}" with the original_question in refine_question_and_concept
    refine_question_and_concept = refine_question_and_concept.replace("{original_question}", original_question)

    completion = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        temperature=0.2,
        messages=[
            {"role": "system", "content": ""},
            {"role": "user", "content": f"{refine_question_and_concept}"}
        ]
    )

    return completion.choices[0].message.content
