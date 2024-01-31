import { OpenAI } from "openai";
import { Stream } from "openai/streaming";
import { WebSocket } from "ws";

export class AiHelper {
  openaiClient: OpenAI;
  wsClientSocket: WebSocket;
  modelName = "gpt-4-0125-preview";
  maxTokens = 2048;
  temperature = 0.7;

  constructor(wsClientSocket: WebSocket) {
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
    this.wsClientSocket.send(
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
    previousIdeas: string | null,
    firstMessage: string | null
  ): Promise<string | null | undefined> {
    if (!previousIdeas) {
      previousIdeas = "";
    }

    // Replace previous_ideas text "aoirvb8735" with new lines
    previousIdeas = previousIdeas.replace(/aoirvb8735/g, "\n");

    try {
      // Moderation check
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

        if (previousIdeas && previousIdeas.length > 0) {
          previousIdeas = `Previous answer ideas:\n${previousIdeas}\n\n`;

          if (firstMessage) {
            firstMessageWithPreviousIdeasTemplate =
              "For your answers please follow the tone of voice, prose, style, and length of the Previous answer ideas\n";
          }
        }

        const messages = [
          {
            role: "system",
            content: `You are a highly competent AI that is able to generate short answer ideas for questions.
                      Never output the answer number at the start of a sentence.\n${firstMessageWithPreviousIdeasTemplate}`,
          },
          {
            role: "user",
            content: `What are some possible answers to the question: ${question}\n\n${previousIdeas}Answers:\n`,
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
    questionId: string,
    contextPrompt: string,
    answers: Array<{ data: string; wins: number; losses: number }>
  ): Promise<void> {
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
          `${answer.data} (Won: ${answer.wins}, Lost: ${answer.losses})`
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
        ];

        await this.streamChatCompletions(messages);

        return;
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
