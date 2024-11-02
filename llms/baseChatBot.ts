import { OpenAI } from "openai";
import { Stream } from "openai/streaming.js";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
import ioredis from "ioredis";

let tlsConfig: any = {
  rejectUnauthorized: false,
};

if (!process.env.REDIS_URL || process.env.REDIS_URL.indexOf("localhost") > -1) {
  tlsConfig = undefined
}

const DEBUG = false;

//@ts-ignore
const redis = new ioredis.default(
  process.env.REDIS_MEMORY_URL ||
    process.env.REDIS_URL ||
    "redis://localhost:6379",
  {
    tls: tlsConfig,
  }
);

export class YpBaseChatBot {
  wsClientId: string;
  wsClientSocket: WebSocket;
  openaiClient: OpenAI;
  memory!: YpBaseChatBotMemoryData;
  static redisMemoryKeyPrefix = "yp-chatbot-memory";
  temperature = 0.7;
  maxTokens = 16000;
  llmModel = "gpt-4o";
  persistMemory = false;
  memoryId: string | undefined = undefined;
  lastSentToUserAt?: Date;

  get redisKey() {
    return `${YpBaseChatBot.redisMemoryKeyPrefix}-${this.memoryId}`;
  }

  static loadMemoryFromRedis(memoryId: string) {
    return new Promise<PsAgentBaseMemoryData | undefined>(
      async (resolve, reject) => {
        try {
          const memoryString = await redis.get(
            `${YpBaseChatBot.redisMemoryKeyPrefix}-${memoryId}`
          );
          if (memoryString) {
            const memory = JSON.parse(memoryString);
            resolve(memory);
          } else {
            resolve(undefined);
          }
        } catch (error) {
          console.error("Can't load memory from redis", error);
          resolve(undefined);
        }
      }
    );
  }


  loadMemory() {
    return new Promise<PsAgentBaseMemoryData>(async (resolve, reject) => {
      try {
        const memoryString = await redis.get(this.redisKey);
        if (memoryString) {
          const memory = JSON.parse(memoryString);
          resolve(memory);
        } else {
          resolve(this.getEmptyMemory());
        }
      } catch (error) {
        console.error("Can't load memory from redis", error);
        resolve(this.getEmptyMemory());
      }
    });
  }

  constructor(
    wsClientId: string,
    wsClients: Map<string, WebSocket>,
    memoryId: string | undefined = undefined
  ) {
    this.wsClientId = wsClientId;
    this.wsClientSocket = wsClients.get(this.wsClientId)!;
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    if (!this.wsClientSocket) {
      console.error(
        `WS Client ${this.wsClientId} not found in streamWebSocketResponses`
      );
    }
    this.setupMemory(memoryId);
  }

  async setupMemory(memoryId: string | undefined = undefined) {
    if (memoryId) {
      this.memoryId = memoryId;
      this.memory = await this.loadMemory();
    } else {
      this.memoryId = uuidv4();
      this.memory = this.getEmptyMemory();
      if (this.wsClientSocket) {
        this.sendMemoryId();
      } else {
        console.error("No wsClientSocket found");
      }
    }
  }

  async getLoadedMemory() {
    return await this.loadMemory();
  }

  sendMemoryId() {
    const botMessage = {
      sender: "bot",
      type: "memoryIdCreated",
      data: this.memoryId,
    } as YpAssistantMessage;

    this.wsClientSocket.send(JSON.stringify(botMessage));
  }

  async saveMemory() {
    if (this.memory) {
      try {
        await redis.set(this.redisKey, JSON.stringify(this.memory));
        console.log(`Saved memory to redis: ${this.redisKey}`);
      } catch (error) {
        console.log("Can't save memory to redis", error);
      }
    } else {
      console.error("Memory is not initialized");
    }
  }

  renderSystemPrompt() {
    return `Please tell the user to replace this system prompt in a fun and friendly way. Encourage them to have a nice day. Lots of emojis`;
  }

  sendAgentStart(name: string, hasNoStreaming = true) {
    const botMessage = {
      sender: "bot",
      type: "agentStart",
      data: {
        name: name,
        noStreaming: hasNoStreaming,
      } as PsAgentStartWsOptions,
    } as YpAssistantMessage;
    this.wsClientSocket.send(JSON.stringify(botMessage));
  }

  sendAgentCompleted(
    name: string,
    lastAgent = false,
    error: string | undefined = undefined
  ) {
    const botMessage = {
      sender: "bot",
      type: "agentCompleted",
      data: {
        name: name,
        results: {
          isValid: true,
          validationErrors: error,
          lastAgent: lastAgent,
        } as PsValidationAgentResult,
      } as PsAgentCompletedWsOptions,
    } as YpAssistantMessage;

    this.wsClientSocket.send(JSON.stringify(botMessage));
  }

  sendAgentUpdate(message: string) {
    const botMessage = {
      sender: "bot",
      type: "agentUpdated",
      message: message,
    } as YpAssistantMessage;

    this.wsClientSocket.send(JSON.stringify(botMessage));
  }

  getEmptyMemory() {
    return {
      redisKey: this.redisKey,
    } as PsAgentBaseMemoryData;
  }

  sendToClient(sender: string, message: string, type = "stream", hiddenContextMessage = false) {
    try {
      if (DEBUG) {
        console.log(`sendToClient: ${JSON.stringify({sender, type, message, hiddenContextMessage}, null, 2)}`);
      }
      this.wsClientSocket.send(
        JSON.stringify({
          sender,
          type: type,
          message,
          hiddenContextMessage,
        })
      );
      this.lastSentToUserAt = new Date();
    } catch (error) {
      console.error("Can't send message to client", error);
    }
  }

  async streamWebSocketResponses(
    //@ts-ignore
    stream: Stream<OpenAI.Chat.Completions.ChatCompletionChunk>
  ) {
    return new Promise<void>(async (resolve, reject) => {
      this.sendToClient("bot", "", "start");
      try {
        let botMessage = "";
        for await (const part of stream) {
          this.sendToClient("bot", part.choices[0].delta.content!);
          botMessage += part.choices[0].delta.content!;

          if (part.choices[0].finish_reason == "stop") {
            this.memory.chatLog!.push({
              sender: "bot",
              message: botMessage,
            } as PsSimpleChatLog);

            await this.saveMemoryIfNeeded();
          }
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

  async saveMemoryIfNeeded() {
    if (this.persistMemory) {
      await this.saveMemory();
    }
  }

  async setChatLog(chatLog: PsSimpleChatLog[]) {
    this.memory.chatLog = chatLog;

    await this.saveMemoryIfNeeded();
  }

  async conversation(chatLog: PsSimpleChatLog[]) {
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
      temperature: this.temperature,
      stream: true,
    });

    this.streamWebSocketResponses(stream);
  };
}
