import {
  streamText,
  type ModelMessage,
  type LanguageModel,
  type ToolSet,
  type LanguageModelUsage,
} from "ai";
import { isRetryable, calculateDelay, sleep } from "./retry.ts";
import { zodToJsonSchema } from "zod-to-json-schema";
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
    // console.log("tools 结构:", JSON.stringify(tools, null, 2));

    for (let attempt = 1; ; attempt++) {
      try {
        // const error = new Error("529, too many requests, await fetch");
        // throw error;
        // console.log(
        //   "发给 LLM 的工具定义（推测）:",
        //   JSON.stringify(
        //     zodToJsonSchema(tools.get_weather_custom.parameters),
        //     null,
        //     2,
        //   ),
        // );
        const result = streamText({
          model,
          system: systemPrompt,
          messages,
          tools,
          maxRetries: 0, // 使用外层控制循环次数
          // toolChoice: "required", // 强制模型必须调工具
          onStepFinish: ({ toolCalls, toolResults }) => {
            // console.log("本轮 toolCalls:", JSON.stringify(toolCalls, null, 2));
            // console.log(
            //   "本轮 toolResults:",
            //   JSON.stringify(toolResults, null, 2),
            // );
          },
          /****
           * stopWhen: 内部多步循环的时候的终止条件。
           * SDK集成了一些操作，工具调用，结果push到messages
           * 这本来是两轮的循环，SDK集成为一次循环。
           * 设计的目的是方便开发减少每次push的胶水代码。
           * ******/
          // stopWhen: isLoopFinished(), //
        });
        // console.log("res-111", result);
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
              console.log("工具结果:", part.output + "666;");
              break;
            }

            // 6. 错误捕捉
            // case "error": {
            //   console.error("流异常:", part.error);
            //   break;
            // }
          }
        }
        // console.log("stepResponse-result", result);
        stepResponse = await result.responseMessages;
        // stepResponse = await result.response;
        stepUsage = await result.usage;
        finishReason = await result.finishReason; // 结束原因
        break;
      } catch (error: any) {
        finishReason = "error";
        console.log("error-finishReason", JSON.stringify(error));
        break;
        // 在这里处理http异常
        // if (isRetryable(error)) {
        //   console.log("重试:", error.message);
        //   if (attempt > MAX_RETRIES) {
        //     const errorMessage = `重试次数${attempt},已超过最大值${MAX_RETRIES}执行Model降级`;
        //     console.log(errorMessage);
        //     throw new Error(errorMessage);
        //   }
        //   const delay = calculateDelay(attempt);
        //   await sleep(delay);
        //   // 清空数据当前循环从新开始
        //   fullText = "";
        // } else {
        //   break;
        // }
      }
    }
    if (Array.isArray(stepResponse)) {
      messages.push(...stepResponse);
    }
    console.log(`\n\n第${step}轮`);
    console.log("\n\nreason", finishReason);
    // console.log("\n\nusage", stepUsage);
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
    // 我在只写了询问上海天气的时候发现走了两轮是因为finishReason=tool-calls，如果加上stopWhen: isLoopFinished() 就会只有一轮，因为streamText内部会判断后续没有可执行的操作了，把后边的操作强制中断。
  }
}
