from models.post import Post
import openai
import string

from langchain import PromptTemplate

system_message = """You are an effective text summarization and shortening system.
If you can't shorten or summarize the text just output the original text.
"""

emoji_system_message = """You are a helpful Emoji generator. You must always output 2 Emojis, not 1 and not 3."""

one_word_system_message = """You are a helpful and advanced summary tool. You can take the text and create a one-word emotional summary. """

emoji_prompt_prefix  = """Please read the text here carefully and then create two Emojis to represent the concept. \
Only output two emojis and no text. Let's think step by step:

"""

one_word_prompt_prefix = """Please read the text here carefully and then output one word that best describes the idea in the most emotional way. Do not use the most obvious word, like Dog, for dog-related ideas. Dive deeper. Only output one word. Let's think step by step:

"""

short_name_prompt_prefix = """Please shorten the idea name as much as possible without using abbreviations.

"""

short_summary_prefix = """Please summarize the text below as much as possible without using abbreviations in one short paragraph. Please keep it as short as possible.

"""

full_summary_prefix = """Please summarize the text below in detail and leave no part of the concept out.

"""

full_points_for_summary_prefix = """Please summarize the points for the idea below in full detail, in one to three paragraphs, and leave nothing out. All opinions in the points below must be included in this summary.

"""

short_points_for_summary_prefix = """Please summarize the points for below as much as possible without using abbreviations in one short paragraph. Please keep it very short, only a few sentences.

"""

full_points_against_summary_prefix = """Please summarize the points against the idea below in full detail, in one to three paragraphs, and leave nothing out. All opinions in the points below must be included in this summary.

"""

short_points_against_summary_prefix = """Please summarize the points against below as much as possible without using abbreviations in one short paragraph. Please keep it very short, only a few sentences.


"""

is_prefix_postfix = """

"""

emojiSummaryTemplate = """{emojis}"""

oneWordSummaryTemplate = """{one_word}"""

shortPostNameTemplate = """{name} [{source}]

  Neighborhood: {group_name}\n\n
"""

summaryTemplate = """{summary} [{source}]

  Neighborhood: {group_name}

"""

summaryWithPointsTemplate = """{summary} [{source}]

  Neighborhood: {group_name}

  Points for: {points_for}

  Points against: {points_against}

  <image_url={image_url}>
  <likes={counter_endorsements_up}>
  <dislikes={counter_endorsements_down}>\n\n
"""

summaryWithPointsAndImageTemplate = """{summary} [{source}]

  Neighborhood: {group_name}

  Points for: {points_for}

  Points against: {points_against}

  <image_url={image_url}>
  <likes={counter_endorsements_up}>
  <dislikes={counter_endorsements_down}>\n\n
"""

def summarize_text(prompt, text, custom_system_message = None):
    completion = openai.ChatCompletion.create(
#        model="gpt-3.5-turbo",
        model="gpt-4",
        temperature=0.2,
        messages=[
            {"role": "system", "content": custom_system_message or system_message},
            {"role": "user", "content": f"{prompt}{text}"}
        ]
    )

    return completion.choices[0].message.content

def summarize_emoji(text):
    return summarize_text(emoji_prompt_prefix, text, emoji_system_message)

def summarize_one_word(text):
    return summarize_text(one_word_prompt_prefix, text,one_word_system_message)

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

def get_emoji_summary(post: Post):
    prompt = PromptTemplate(
        input_variables=["emojis"],
        template=emojiSummaryTemplate,
    )

    emoji_summary = summarize_emoji(f"{post.name}\n{post.description}")

    print(emoji_summary)

    return prompt.format(emojis=emoji_summary)


def get_one_word_summary(post: Post):
    prompt = PromptTemplate(
        input_variables=["one_word"],
        template=oneWordSummaryTemplate,
    )

    one_word_summary = summarize_one_word(f"{post.name}\n{post.description}")

    print(one_word_summary)

    one_word_summary = one_word_summary.translate(str.maketrans('', '', string.punctuation))

    return prompt.format(one_word=one_word_summary)

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

