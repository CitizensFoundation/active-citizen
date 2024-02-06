import { OpenAI } from "openai";
import { Stream } from "openai/streaming";
import { WebSocket } from "ws";

export class AiHelper {
  openaiClient: OpenAI;
  wsClientSocket: WebSocket | undefined;
  modelName = "gpt-4-0125-preview";
  maxTokens = 2048;
  temperature = 0.7;

  constructor(wsClientSocket: WebSocket | undefined = undefined) {
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.wsClientSocket = wsClientSocket;
  }

  async streamChatCompletions(messages: any[]): Promise<void> {
    const stream: Stream<OpenAI.Chat.Completions.ChatCompletionChunk> =
      await this.openaiClient.chat.completions.create({
        model: this.modelName,
        messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        stream: true,
      });

    await this.streamWebSocketResponses(stream);
  }

  sendToClient(sender: string, message: string, type = "stream") {
    this.wsClientSocket?.send(
      JSON.stringify({
        sender,
        type: type,
        message,
      })
    );
  }

  async streamWebSocketResponses(
    stream: Stream<OpenAI.Chat.Completions.ChatCompletionChunk>
  ) {
    return new Promise<void>(async (resolve, reject) => {
      this.sendToClient("bot", "", "start");
      try {
        let botMessage = "";
        for await (const part of stream) {
          this.sendToClient("bot", part.choices[0].delta.content!);
          botMessage += part.choices[0].delta.content!;
        }
      } catch (error) {
        console.error(error);
        this.sendToClient(
          "bot",
          "There has been an error, please retry",
          "error"
        );
        reject();
      } finally {
        this.sendToClient("bot", "", "end");
      }
      resolve();
    });
  }

  async getAnswerIdeas(
    question: string,
    previousIdeas: string[] | null,
    firstMessage: string | null
  ): Promise<string | null | undefined> {
    try {
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
        let firstMessageWithPreviousIdeasTemplate = "";

        let previewIdeasText = "";

        if (previousIdeas && previousIdeas.length > 0) {
          previewIdeasText = `Previous answer ideas:\n${JSON.stringify(
            previousIdeas,
            null,
            2
          )}\n\n`;

          if (firstMessage) {
            firstMessageWithPreviousIdeasTemplate =
              "For your answers please follow the tone of voice, prose, style, and length of the Previous answer ideas\n";
          }
        }

        const messages = [
          {
            role: "system",
            content: `You are a highly competent AI that is able to generate short answer ideas for questions.
                      Genereate up to 10 high quality ideas.
                      Ideas should always be unnumbered.
                      Never output more than 30 words per idea.
                      \n${firstMessageWithPreviousIdeasTemplate}`,
          },
          {
            role: "user",
            content: `What are some possible answers to the question: ${question}\n\n${previewIdeasText}Answers:\n`,
          },
        ];

        await this.streamChatCompletions(messages);
      }
    } catch (error) {
      console.error("Error in getAnswerIdeas:", error);
      this.sendToClient(
        "bot",
        "There has been an error, please retry",
        "error"
      );
      return null;
    }
  }

  async getAiAnalysis(
    questionId: number,
    contextPrompt: string,
    answers: Array<{ data: {
      content: string;
    }; wins: number; losses: number }>
  ): Promise<string |null|undefined> {
    const basePrePrompt = `
        You are a highly competent text and ideas analysis AI.
        If an answer sounds implausible as an answer to the question, then include a short observation about it in your analysis.
        Keep your output short, under 300 words.
        The answers have been rated by the public using a pairwise voting method, so the user is always selecting one to win or one to lose.
        Generally, do not include the number of wins and losses in your answers.
        If there are very few wins or losses, under 10 for most of the ideas, then always output a disclaimer to that end, in a separate second paragraph.
        Don't output Idea 1, Idea 2 in your answer.
        Be creative and think step by step.
        If the prompt asks for a table always output a markdown table.
    `;

    const answersText = answers
      .map(
        (answer) =>
          `${answer.data.content} (Won: ${answer.wins}, Lost: ${answer.losses})`
      )
      .join("\n");

    try {
      const moderationResponse = await this.openaiClient.moderations.create({
        input: answersText,
      });

      const flagged = moderationResponse.results[0].flagged;

      if (flagged) {
        console.error("Flagged:", answersText);
        return;
      } else {
        const messages = [
          {
            role: "system",
            content: `${basePrePrompt}\n${contextPrompt}`,
          },
          {
            role: "user",
            content: `The question: ${questionId}\n\nAnswers to analyse:\n${answersText}`,
          },
        ] as any;

        //await this.streamChatCompletions(messages);

        const response = await this.openaiClient.chat.completions.create({
          model: this.modelName,
          messages,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          stream: false,
        });

        return response.choices[0].message.content;
      }
    } catch (error) {
      console.error("Error in getAiAnalysis:", error);
      this.sendToClient(
        "bot",
        "There has been an error, please retry",
        "error"
      );
    }
  }
}