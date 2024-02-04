import { jsonrepair } from "jsonrepair";
import { OpenAI } from "openai";
import ISO6391 from "iso-639-1";

export class YpLlmTranslation {
  openaiClient: OpenAI;
  modelName = "gpt-4-0125-preview";
  maxTokens = 4000;
  temperature = 0.0;

  constructor() {
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  renderSystemPrompt(
    jsonInSchema: string,
    jsonOutSchema: string,
    lengthInfo: string
  ) {
    return `You are a helpful answer translation assistant that knows all the world languages.

INPUTS:
The user will tell us the Language to translate to.

The user will let you know what the question is but you do not need to translate that one.

You will get JSON input with the string to be translated: ${jsonInSchema}

OUTPUT:
You will output JSON format with the translation. ${jsonOutSchema}

INSTRUCTIONS:
The translated text MUST NEVER be more than ${lengthInfo}, otherwise it wont fit the UI.
Please count the words and never go over the limit. Leave some things out off the translation it's going to be too long.
Translate the tone of the original language also.
Always output only JSON.`;
  }

  renderAnswersUserMessage(
    language: string,
    question: string,
    answer: AoiTranslationAnswerInData
  ) {
    return `Language to translate to: ${language}

Question:
${question}

Answers to translate in JSON Input:
${JSON.stringify(answer, null, 2)}

Your ${language} JSON output:`;
  }

  renderQuestionUserMessage(
    language: string,
    question: string,
    questionData: AoiTranslationQuestionInData
  ) {
    return `Language to translate to: ${language}

Question to translate in JSON format:
${JSON.stringify(questionData, null, 2)}

Your ${language} JSON output:`;
  }

  async getChoiceTranslation(
    answerContent: string,
    languageIsoCode: string,
    maxCharactersInTranslation = 140
  ): Promise<string | null | undefined> {
    try {
      console.log(`getChoiceTranslation: ${answerContent}`)
      const languageName = ISO6391.getName(languageIsoCode) || "en";
      const moderationResponse = await this.openaiClient.moderations.create({
        input:answerContent
      });
      console.log("Moderation response:", moderationResponse);
      const flagged = moderationResponse.results[0].flagged;
      console.log("Flagged:", flagged);

      if (flagged) {
        console.error("Flagged:", answerContent);
        return null;
      } else {
        const inAnswer = {
          originalAnswer:answerContent
        } as AoiTranslationAnswerInData;

        const jsonInSchema = `{ originalAnswer: string}`;
        const jsonOutSchema = `{ translatedContent: string}`;
        const lengthInfo = `26 words long or 140 characters`;

        return await this.callLlm(
          jsonInSchema,
          jsonOutSchema,
          lengthInfo,
          languageName,
          "",
          inAnswer,
          maxCharactersInTranslation,
          this.renderAnswersUserMessage
        );
      }
    } catch (error) {
      console.error("Error in getAnswerIdeas:", error);
      return undefined;
    }
  }

  async getQuestionTranslation(
    question: string,
    languageIsoCode: string,
    maxCharactersInTranslation = 300
  ): Promise<string | null | undefined> {
    try {
      console.log(`getQuestionTranslation: ${question} ${languageIsoCode}`)
      const languageName = ISO6391.getName(languageIsoCode) || "en";
      const moderationResponse = await this.openaiClient.moderations.create({
        input: question,
      });
      console.log("Moderation response:", moderationResponse);
      const flagged = moderationResponse.results[0].flagged;
      console.log("Flagged:", flagged);

      if (flagged) {
        console.error("Flagged:", question);
        return null;
      } else {
        const inQuestion = {
          originalQuestion: question
        } as AoiTranslationQuestionInData;

        const jsonInSchema = `{ originalAnswer: string}`;
        const jsonOutSchema = `{ translatedContent: string}`;
        const lengthInfo = `40 words long or 250 characters`;

        return await this.callLlm(
          jsonInSchema,
          jsonOutSchema,
          lengthInfo,
          languageName,
          question,
          inQuestion,
          maxCharactersInTranslation,
          this.renderQuestionUserMessage
        );
      }
    } catch (error) {
      console.error("Error in getAnswerIdeas:", error);
      return undefined;
    }
  }

  async callLlm(
    jsonInSchema: string,
    jsonOutSchema: string,
    lengthInfo: string,
    languageName: string,
    question: string,
    inObject: AoiTranslationAnswerInData | AoiTranslationQuestionInData,
    maxCharactersInTranslation: number,
    userRenderer: Function
  ): Promise<string | null | undefined> {
    const messages = [
      {
        role: "system",
        content: this.renderSystemPrompt(
          jsonInSchema,
          jsonOutSchema,
          lengthInfo
        ),
      },
      {
        role: "user",
        content: userRenderer(
          languageName,
          question,
          inObject
        ),
      },
    ] as any;

    const maxRetries = 3;
    let retries = 0;

    let running = true;

    while (running) {
      try {
        console.log(`Messages ${retries}:`, messages);
        const results = await this.openaiClient.chat.completions.create({
          model: this.modelName,
          messages,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
        });

        console.log("Results:", results);
        const textJson = results.choices[0].message.content;
        console.log("Text JSON:", textJson);

        if (textJson) {
          const translationData = JSON.parse(
            jsonrepair(textJson)
          ) as AoiTranslationAnswerOutData;
          if (translationData && translationData.translatedContent) {
            if (
              translationData.translatedContent.length >
              maxCharactersInTranslation
            ) {
              throw new Error("Translation too long");
            }
            running = false;
            return translationData.translatedContent;
          }
        } else {
          throw new Error("No content in response");
        }
      } catch (error) {
        console.error("Error in getChoiceTranslation:", error);
        retries++;
        if (retries > maxRetries) {
          running = false;
          return undefined;
        }
      }
    }
  }
 }
