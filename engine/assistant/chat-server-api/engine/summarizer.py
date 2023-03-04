import openai
from langchain import PromptTemplate

system_message = "You are an effective text summarization system."

short_name_prompt_prefix = """
  Please shorten this idea name as much as possible without using abbreviations:

"""

short_summary_prefix = """
  Please summarize the text below as much as possible without using abbreviations in one short paragraph. Please keep it as short as possible.

"""

full_summary_prefix = """
  Please summarize the text below in detail and leave no part of the concept out.

"""

full_points_for_summary_prefix = """
  Please summarize the points for the idea below in full detail, in one to three paragraphs, and leave nothing out. All opinions in the points below must be included in this summary.

"""

short_points_for_summary_prefix = """
  Please summarize the points for below as much as possible without using abbreviations in one short paragraph. Please keep it very short, only a few sentences.

"""

full_points_against_summary_prefix = """
  Please summarize the points against the idea below in full detail, in one to three paragraphs, and leave nothing out. All opinions in the points below must be included in this summary.

"""

short_points_against_summary_prefix = """
  Please summarize the points against below as much as possible without using abbreviations in one short paragraph. Please keep it very short, only a few sentences.

"""

shortNameTemplate = """
  {name}
  neighborhood: {group_name}
  source: {source}\n
"""

def summarize_text(prompt, text, max_tokens=1000):
    completion = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        temperature=0.2,
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": f"{prompt}{text}"}
        ]
    )

    return completion.choices[0].message.content

def summarize_short_name(text):
    return summarize_text(short_name_prompt_prefix, text)

def summarize_short_summary(text):
    return summarize_text(short_summary_prefix, text)

def summarize_full_summary(text):
    return summarize_text(full_summary_prefix, text)

def summarize_full_points_for_summary(text):
    return summarize_text(full_points_for_summary_prefix, text)

def summarize_short_points_for_summary(text):
    return summarize_text(short_points_for_summary_prefix, text)

def summarize_full_points_against_summary(text):
    return summarize_text(full_points_against_summary_prefix, text)

def summarize_short_points_against_summary(text):
    return summarize_text(short_points_against_summary_prefix, text)

def get_short_name_summary(name,group_name,id):
  prompt = PromptTemplate(
    input_variables=["name", "source"],
    template=shortNameTemplate,
  )

  short_name = summarize_short_name(name)

  prompt.compile(name=short_name, group_name=group_name, source=id)

  return prompt
