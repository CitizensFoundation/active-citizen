import { OpenAI } from "openai";
import { Stream } from "openai/streaming";
import { WebSocket } from "ws";

import { YpBaseChatBot } from "../../llms/baseChatBot.js";

export class ExplainAnswersAssistant extends YpBaseChatBot {
  openaiClient: OpenAI;
  modelName = "gpt-4-0125-preview";
  maxTokens = 4000;
  temperature = 0.8;

  constructor( wsClientId: string, wsClients: Map<string, WebSocket>
    ) {
    super(
      wsClientId,
      wsClients,
      undefined)
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  renderSystemPrompt() {
    return `The user is doing pairwise voting on two answers at the time, to a question, the user needs help decide what to vote on.

Instructions:
Use a relevant emoji for the first and second answers.
Use thumbs emojis for pros and thumb down emjoi for cons
Use summary emoji for summary.
Use simple and upbeat language.
Ask the user clarifying questions if needed.

Output:
* Each answer
-- One short paragraph, max three sentences, explaination in a very simple language
-- The top pro and con
-- If this is likely to be a root cause of the problem set out in the question
* Short summary in the end of which answer is better and why
`;
  }

  explainConversation = async (chatLog: PsSimpleChatLog[]) => {
    this.setChatLog(chatLog);

    let messages: any[] = chatLog.map((message: PsSimpleChatLog) => {
      return {
        role: message.sender,
        content: message.message,
      };
    });

    const systemMessage = {
      role: "system",
      content: this.renderSystemPrompt(),
    };

    messages.unshift(systemMessage);

    const stream = await this.openaiClient.chat.completions.create({
      model: this.llmModel,
      messages,
      max_tokens: this.maxTokens,
      temperature: this.tempeture,
      stream: true,
    });

    this.streamWebSocketResponses(stream);
  };
}