from models.post import Post
import openai
from langchain import PromptTemplate

system_message = """You are an effective text summarization and shortening system.
If you can't shorten text just output the original text.
Always output text without an explaination.
"""

short_name_prompt_prefix = """
  Please shorten the idea name as much as possible without using abbreviations.

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

shortPostNameTemplate = """Idea: {name}

  Neighborhood: {group_name}

  Source: {source}\n\n
"""

summaryTemplate = """Idea: {summary}

  Neighborhood: {group_name}

  Source: {source}
"""

summaryWithPointsTemplate = """Idea: {summary}

  Neighborhood: {group_name}

  Points for: {points_for}

  Points against: {points_against}

  Source: {source}

  <image_url={image_url}>
  <likes={counter_endorsements_up}>
  <dislikes={counter_endorsements_down}>\n\n
"""

summaryWithPointsAndImageTemplate = """Idea: {summary}

  Neighborhood: {group_name}

  Points for: {points_for}

  Points against: {points_against}

  Source: {source}

  <image_url={image_url}>
  <likes={counter_endorsements_up}>
  <dislikes={counter_endorsements_down}>\n\n
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


def get_short_post_name(post: Post):
    prompt = PromptTemplate(
        input_variables=["name", "group_name", "source"],
        template=shortPostNameTemplate,
    )

    short_name = summarize_short_name(post.name)

    print(short_name)

    return prompt.format(name=short_name, group_name=post.group_name, source=post.post_id)


def get_short_post_summary(post: Post):
    prompt = PromptTemplate(
        input_variables=["group_name", "source","summary"],
        template=summaryTemplate,
    )

    short_summary = summarize_short_summary(f"{post.name}\n{post.description}")

    print(short_summary)

    return prompt.format(summary=short_summary, group_name=post.group_name, source=post.post_id)


def get_full_post_summary(post: Post):
    prompt = PromptTemplate(
               input_variables=["group_name", "source","summary"],
        template=summaryTemplate,
    )

    full_summary = summarize_full_summary(f"{post.name}\n{post.description}")
    print(full_summary)

    return prompt.format(summary=full_summary, group_name=post.group_name, source=post.post_id)

def get_short_post_summary_with_points(post: Post):
    prompt = PromptTemplate(
        input_variables=["group_name",
                         "counter_endorsements_up", "counter_endorsements_down",
                         "source", 'points_for', 'points_against',"summary","image_url"],
        template=summaryWithPointsTemplate,
    )

    short_summary = summarize_short_summary(f"{post.name}\n{post.description}")

    points_for_short_summary = ""
    points_against_short_summary = ""

    if post.points_for!="":
        points_for_short_summary = summarize_short_points_for_summary(
            f"{post.name}\n{post.points_for}")

    if post.points_against!="":
        points_against_short_summary = summarize_short_points_against_summary(
            f"{post.name}\n{post.points_against}")

    print(short_summary)
    print(points_for_short_summary)
    print(points_against_short_summary)

    return prompt.format(summary=short_summary, group_name=post.group_name, source=post.post_id,
                           image_url=post.image_url,
                  counter_endorsements_up=post.counter_endorsements_up, counter_endorsements_down=post.counter_endorsements_down,
                   points_for=points_for_short_summary, points_against=points_against_short_summary)

def get_full_post_summary_with_points(post: Post):
    prompt = PromptTemplate(
        input_variables=["group_name",
                         "counter_endorsements_up", "counter_endorsements_down",
                         "source", 'points_for', 'points_against',"summary","image_url"],
        template=summaryWithPointsAndImageTemplate,
    )

    short_summary = summarize_full_summary(f"{post.name}\n{post.description}")

    points_for_short_summary = ""
    points_against_short_summary = ""

    if post.points_for!="":
        points_for_short_summary = summarize_full_points_for_summary(
            f"{post.name}\n{post.points_for}")

    if post.points_against!="":
        points_against_short_summary = summarize_full_points_against_summary(
            f"{post.name}\n{post.points_against}")

    return prompt.format(summary=short_summary, group_name=post.group_name, source=post.post_id,
                   image_url=post.image_url,
                   counter_endorsements_up=post.counter_endorsements_up, counter_endorsements_down=post.counter_endorsements_down,
                   points_for=points_for_short_summary, points_against=points_against_short_summary)

