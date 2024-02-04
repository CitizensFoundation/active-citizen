import { OpenAI } from "openai";
import { Stream } from "openai/streaming";
import { WebSocket } from "ws";

import { YpBaseChatBot } from "../../llms/baseChatBot.js";

export class ExplainAnswersAssistant extends YpBaseChatBot {
  openaiClient: OpenAI;
  modelName = "gpt-4-0125-preview";
  maxTokens = 4000;
  temperature = 0.5;

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
    return `The user is doing pairwise voting on two answers at the time, to a provided question. Please help explain to the user the pros and cons of each answer, to help the user make up their mind on which one to vote on.`;
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
