import {
  streamText,
  type ModelMessage,
  type LanguageModel,
  type ToolSet,
  type LanguageModelUsage,
} from "ai";
import { isRetryable, calculateDelay, sleep } from "./retry.ts";
const MAX_STEPS = 30; // 最大轮询次数
const MAX_RETRIES = 3; // 最多重试次数
const MAX_TOTAL_TOKEN = 5000; // 最大token
export interface LoopConfigInterface {
  model: LanguageModel;
  messages: ModelMessage[];
  tools: any;
  systemPrompt: string;
}

export async function AgentLoop(options: LoopConfigInterface) {
  const { model, messages, tools, systemPrompt } = options;
  let step = 0;
  let fullText = "";
  let finishReason: string = "";
  let stepResponse: any = null;
  let stepUsage: LanguageModelUsage | undefined;
  while (step < MAX_STEPS) {
    step++;
    /**
     * @param model: 模型
     * @param tools: 工具集
     *
     * @param systemPrompt: 系统提示词
     * @param
     * ******/
    // 重试的操作不计入下次循环，就在当前重试，成功或者失败之后再继续
    // 处理同种错误类型重试不能超过MAX_RETRIES
    // for循环这种写法等价于
    // let attempt = 1;
    // while(true) {
    //  try{
    //  }catch (error) {
    //    attempt++;
    //  }
    // }
    for (let attempt = 1; ; attempt++) {
      try {
        // const error = new Error("529, too many requests, await fetch");
        // throw error;
        const result = streamText({
          model,
          system: systemPrompt,
          messages,
          tools,
          maxRetries: 0, // 使用外层控制循环次数
        });

        // 遍历流事件
        for await (const part of result.stream) {
          switch (part.type) {
            // 1. 文本增量事件
            case "text-delta": {
              // 对应字段为 textDelta
              process.stdout.write(part.text);
              fullText += part.text;
              break;
            }

            // 2. 思考/推理过程事件（注意：是 reasoning-delta，不是 reasoning）
            case "reasoning-delta": {
              // 对应字段为 textDelta (部分版本为 text)
              const reasoningChunk = part.text;
              console.log("思考中:", reasoningChunk);
              fullText += part.text;
              break;
            }

            // 3. 思考/推理开始与结束（可选监听）
            case "reasoning-start": {
              console.log("--- 开始思考 ---");
              break;
            }
            case "reasoning-end": {
              console.log("--- 思考结束 ---");
              break;
            }

            // 4. 工具调用事件
            case "tool-call": {
              console.log("工具调用:", part.toolName, part.input);
              break;
            }

            // 5. 工具执行结果
            case "tool-result": {
              console.log("工具结果:", part.output);
              break;
            }

            // 6. 错误捕捉
            case "error": {
              console.error("流异常:", part.error);
              break;
            }
          }
        }
        stepResponse = await result.responseMessages;
        stepUsage = await result.usage;
        finishReason = await result.finishReason; // 结束原因
        break;
      } catch (error: any) {
        // 在这里处理http异常
        if (isRetryable(error)) {
          console.log("重试:", error.message);
          if (attempt > MAX_RETRIES) {
            const errorMessage = `重试次数${attempt},已超过最大值${MAX_RETRIES}执行Model降级`;
            console.log(errorMessage);
            throw new Error(errorMessage);
          }
          const delay = calculateDelay(attempt);
          await sleep(delay);
          // 清空数据当前循环从新开始
          fullText = "";
        } else {
          break;
        }
      }
    }
    messages.push(...stepResponse);
    console.log(`\n\n第${step}轮`);
    console.log("\n\nreason", finishReason);
    console.log("\n\nusage", stepUsage);
    // token超出退出
    if (stepUsage?.totalTokens && stepUsage?.totalTokens > MAX_TOTAL_TOKEN) {
      console.log(`token 超过${MAX_TOTAL_TOKEN}`);
      break;
    }
    if (
      finishReason === "stop" ||
      finishReason === "length" ||
      finishReason === "error"
    ) {
      // 任务完成退出
      console.log("结束退出\n\n");
      break;
    }
  }
}

// streamText的入参和输出数据结构
// /**
//  * =========================================================================
//  * 1. streamText 传入参数结构 (StreamTextOptions)
//  * =========================================================================
//  */
// const streamTextParams = {
//   // 【必填】使用的语言模型对象，如 openai('gpt-4o') 或 anthropic('claude-3-5-sonnet-20240620')
//   model: openai('gpt-4o'),

//   // 【可选】输入的提示词字符串（与 messages 二选一或搭配使用）
//   prompt: '请写一篇关于人工智能发展的简短总结。',

//   // 【可选】系统提示词，用于定义模型的行为或角色
//   system: '你是一位严谨的计算机科学家。',

//   // 【可选】历史消息数组，常用于多轮对话 (与 prompt 互斥或补充)
//   // 支持 CoreSystemMessage | CoreUserMessage | CoreAssistantMessage | CoreToolMessage
//   messages: [
//     { role: 'system', content: '系统角色指令' },
//     { role: 'user', content: '你好，请帮我分析这份代码' },
//     {
//       role: 'user',
//       content: [
//         { type: 'text', text: '看下这张图片' },
//         { type: 'image', image: 'https://example.com/image.png' } // 支持 URL、Base64、Buffer 等
//       ]
//     }
//   ],

//   // 【可选】定义可供模型调用的工具函数集合
//   tools: {
//     getWeather: {
//       description: '获取指定城市的天气',
//       parameters: z.object({ city: z.string() }), // 使用 Zod 定义参数 Schema
//       execute: async ({ city }) => { return { temp: 25, unit: 'C' }; } // 【可选】自动执行的函数
//     }
//   },

//   // 【可选】工具选择策略：'auto' | 'none' | 'required' | { type: 'tool', toolName: string }
//   toolChoice: 'auto',

//   // 【可选】允许模型连续调用 Tool 的最大步数（默认 1，开启多轮 Tool 交互可设为 >1，如 5）
//   maxSteps: 1,

//   // 【可选】生成文本的最大 Token 数量
//   maxTokens: 1000,

//   // 【可选】采样温度 (0.0 到 2.0)，建议与 topP 二选一使用
//   temperature: 0.7,

//   // 【可选】核采样 threshold (0.0 到 1.0)
//   topP: 0.9,

//   // 【可选】Top-K 采样
//   topK: 40,

//   // 【可选】存在惩罚 (-2.0 到 2.0)
//   presencePenalty: 0.0,

//   // 【可选】频率惩罚 (-2.0 到 2.0)
//   frequencyPenalty: 0.0,

//   // 【可选】停止序列数组，遇到这些字符串时终止生成
//   stopSequences: ['\n\n---', 'END'],

//   // 【可选】中途抛出异常时的回调函数（因为流传输中错误不会直接抛出 throw，而是会捕获进流）
//   onError: ({ error }) => {
//     console.error('Streaming error:', error);
//   },

//   // 【可选】流结束时的回调函数
//   onFinish: async (event) => {
//     // event 包含: { text, toolCalls, toolResults, finishReason, usage, rawResponse, ... }
//     console.log('Finished text:', event.text);
//     console.log('Token usage:', event.usage);
//   },

//   // 【可选】自定义请求头，传递给底层 API 服务商
//   headers: {
//     'Custom-Header': 'value'
//   },

//   // 【可选】AbortSignal 控制中断请求
//   abortSignal: new AbortController().signal,
// };

// /**
//  * =========================================================================
//  * 2. streamText 返回值数据结构 (StreamTextResult)
//  * =========================================================================
//  */
// const result = streamText(streamTextParams);

// /**
//  * 2.1 基础属性 & 异步 Iterator 属性
//  */
// // 1. 【最常用】纯文本块的异步可迭代流 (AsyncIterable<string>)
// // 可直接使用 `for await (const chunk of result.textStream)` 遍历
// result.textStream;

// // 2. 包含全部事件（文本增量、Tool 调用、Tool 执行结果等）的完整事件流 (AsyncIterable<TextStreamPart>)
// result.fullStream;

// // 3. 原始 Response/ReadableStream 流对象
// result.stream;

// /**
//  * 2.2 Promise 延迟解析属性 (等待流完成后 Resolve)
//  */
// // 最终生成的完整文本内容
// result.text; // Promise<string>

// // 最终完成原因: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other'
// result.finishReason; // Promise<string>

// // Token 消耗详情
// result.usage; // Promise<{ promptTokens: number, completionTokens: number, totalTokens: number }>

// // 模型生成的 Tool 调用详情数组
// result.toolCalls; // Promise<Array<{ toolCallId: string, toolName: string, args: object }>>

// // Tool 执行后的返回结果数组
// result.toolResults; // Promise<Array<{ toolCallId: string, toolName: string, args: object, result: any }>>

// // 生成过程中的响应消息数组（包含 assistant 消息及 tool 交互记录，可直接用于追加更新 messages 历史）
// result.responseMessages; // Promise<Array<CoreSystemMessage | CoreUserMessage | CoreAssistantMessage | CoreToolMessage>>

// // 供应商提供的原始响应信息
// result.rawResponse; // Promise<{ headers?: Record<string, string> }>

// /**
//  * 2.3 辅助 HTTP Response 响应构建方法 (专为 Web API / Next.js / Node 路由设计)
//  */

// // 1. 生成标准的 Data Stream HTTP Response（支持传输文本增量、Tool 执行状态、注解等，适配 frontend `useChat`）
// result.toDataStreamResponse({
//   headers: { 'Cache-Control': 'no-cache' },
//   data: customStreamData // 可附加自定义 StreamData 对象
// }); // Return: Response

// // 2. 将 Data Stream 管道化写入现有的 Node.js ServerResponse ( Express / Fastify )
// result.pipeDataStreamToResponse(nodeServerResponse, { headers: {} });

// // 3. 生成标准的纯文本流 HTTP Response (`text/plain; charset=utf-8`)
// result.toTextStreamResponse(); // Return: Response

// // 4. 将纯文本流管道化写入 Node.js ServerResponse
// result.pipeTextStreamToResponse(nodeServerResponse);
