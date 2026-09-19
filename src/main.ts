import "dotenv/config";
import { AgentLoop } from "./agent/agent-loop.ts";
import { tool, type ModelMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import modelManager from "./model/index.ts";

const model = modelManager.getModel();

export default function bootstrap() {
  console.log("bootstrap");

  const messages: ModelMessage[] = [
    {
      role: "user",
      content: "帮我查下上海的天气情况",
    },
  ];
  const systemPrompt = `你是一个专注于编程领域的AI助手。你可以解决任何编程问题，帮助查找官方文档并给出用法demo；也可以帮助解决bug；更可以写代码，写代码的时候要先规划好之后才能动手。回答要简洁，保证正确率，根据用户的需求，否则不能任意发挥。询问某个城市的天气是用get_weather_custom这个工具`;
  const tools = {
    get_weather_custom: tool({
      description: "获取指定城市的当前天气",
      inputSchema: z.object({
        city: z.string().describe("城市名称，例如：北京、上海"),
      }),
      execute: async ({ city }: { city: string }) => {
        console.log("city", city);
        return `${city}今天是晴天，气温 25 度`;
      },
    }),

    calculate: tool({
      description: "执行数学计算",
      inputSchema: z.object({
        expression: z.string().describe("数学表达式，例如：2 + 3 * 4"),
      }),
      execute: async ({ expression }: { expression: string }) => {
        return eval(expression).toString();
      },
    }),
  };

  AgentLoop({ model, messages, tools, systemPrompt });
}

/**
 * @ai-sdk/openai createOpenAI 函数说明
 * 官方文档: https://ai-sdk.dev/providers/ai-sdk-providers/openai
 * 适用版本: 4.x+ (当前查询版本 4.0.20 结构一致)
 *
 * @param {Object} [options] - 可选的配置对象
 * @param {string} [options.baseURL='https://api.openai.com/v1'] - API 请求的基础 URL。可用于代理服务器或自定义端点。
 * @param {string} [options.apiKey=process.env.OPENAI_API_KEY] - OpenAI API 密钥。通过 Authorization 头发送。
 * @param {string} [options.name='openai'] - 提供者名称。在使用兼容提供者时可更改。
 * @param {string} [options.organization] - OpenAI 组织 ID。
 * @param {string} [options.project] - OpenAI 项目 ID。
 * @param {Record<string, string>} [options.headers] - 包含在所有请求中的自定义请求头。
 * @param {(input: RequestInfo, init?: RequestInit) => Promise<Response>} [options.fetch] - 自定义 fetch 实现。可用于拦截请求或提供测试实现。
 *
 * @returns {OpenAIProvider} 返回一个 OpenAI 提供者实例 (可调用对象)
 *
 * @returns 返回对象结构说明:
 * 1. 作为函数调用: openai('model-id', options) => LanguageModel (自动选择 API)
 * 2. .responses(modelId) => 使用 Responses API 的模型
 * 3. .chat(modelId) => 使用 Chat Completions API 的模型
 * 4. .completion(modelId) => 使用 Completions API 的模型 (已过时)
 * 5. .embedding(modelId) => EmbeddingModel 嵌入模型
 * 6. .image(modelId) => ImageModel 图像生成模型
 * 7. .transcription(modelId) => TranscriptionModel 音频转录模型
 *
 * @example
 * import { createOpenAI } from '@ai-sdk/openai';
 *
 * const openai = createOpenAI({
 *   apiKey: process.env.OPENAI_API_KEY,
 *   baseURL: 'https://api.openai.com/v1',
 *   organization: 'your-org-id',
 *   project: 'your-project-id',
 *   headers: { 'header-name': 'header-value' }
 * });
 *
 * // 使用实例创建模型并调用
 * const model = openai('gpt-4-turbo');
 * // 或指定特定 API
 * const chatModel = openai.chat('gpt-4-turbo');
 */
