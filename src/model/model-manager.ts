import { sleep, calculateDelay } from "../agent/retry.ts";
import { createOpenAI } from "@ai-sdk/openai";
import {
  type provideConfig,
  type modelConfig,
  type modelType,
  type ModelManagerOptionsInterface,
  type ModelErrorType,
  type ModelErrorInterface,
} from "./types.ts";
import { modelList, providerList } from "./config.ts";
import { normalizeError } from "./error-classifier.ts";
import type { LanguageModel } from "ai";

export class ModelManager {
  private static _instance: ModelManager | null = null; // 实例
  private provider: provideConfig | undefined = undefined; // 当前的厂商
  private model: modelConfig | undefined = undefined; // 当前的模型
  private modelType: modelType = "chat"; // 模型类型
  private modelList: modelConfig[] = []; // 模型列表
  private providerList: provideConfig[] = []; // 厂商列表
  private config: ModelManagerOptionsInterface = {
    timeout: 3000,
    maxOutputToken: 5000,
    maxRetries: 3,
  };
  constructor(options?: ModelManagerOptionsInterface) {
    if (ModelManager._instance) {
      return ModelManager._instance;
    }
    this.init(options);
    ModelManager._instance = this;
  }
  // 初始化
  private init(options?: ModelManagerOptionsInterface) {
    try {
      // 合并配置
      this.config = Object.assign(this.config, options);
      this.modelList = modelList;
      this.providerList = providerList;
      this.getModel(options?.model);
    } catch (error) {
      console.error("model 初始化失败");
    }
  }

  // 获取唯一实例
  static getInstance(options: ModelManagerOptionsInterface): ModelManager {
    if (!ModelManager._instance) {
      ModelManager._instance = new ModelManager(options);
    }
    return ModelManager._instance;
  }

  // 获取model
  public getModel(modelId?: string): LanguageModel {
    try {
      const model =
        this.modelList
          .filter((item) => !item.disabled)
          .find((item) => item.id === modelId) || modelList[0];
      if (!model) {
        throw new Error("模型为空！");
      }
      this.model = model;
      this.modelType = model.type;
      this.provider = providerList.find((item) => item.name === model.provider);
      const curProvider = this.provider;
      const curModel = this.model;
      if (!curProvider?.baseUrl || !curProvider?.apiKey) {
        throw new Error("大模型baseUrl和ApiKey不能为空");
      }
      const provider = createOpenAI({
        baseURL: curProvider?.baseUrl,
        apiKey: curProvider?.apiKey,
      });
      const modelInstance = provider.chat(curModel?.id!);
      return modelInstance;
    } catch (error: unknown) {
      console.log("获取Model失败", error);
      throw new Error("获取 Model 失败");
    }
  }

  private handleProvideDisabled(model: modelConfig) {
    const { provider } = model;
    const curProviderModelList = this.modelList.filter(
      (item) => item.provider === provider,
    );
    let curProviderDisabled =
      curProviderModelList.filter((item) => !item.disabled).length === 0; // 如果是0标识provider应该被disabled
    if (curProviderDisabled) {
      const curProvider = this.providerList.find(
        (item) => item.name === provider,
      );
      if (curProvider) {
        curProvider.disabled = true;
      }
    }
  }

  public async execute(fn: Function) {
    try {
      const model = this.getModel();
      await fn(model);
    } catch (error) {
      console.log("error", this.provider?.name, JSON.stringify(error));
      // 处理错误逻辑
      // const errorType = this.getErrorType(error);
      const providerName = this.provider?.name!;
      const err: ModelErrorInterface = normalizeError(
        providerName,
        error,
      ) as ModelErrorInterface;
      const errorType = err.type;
      // 1.如果错误类型是权限类的直接返回
      if (errorType == "AUTH") {
        throw new Error("权限问题");
      }

      if (errorType === "CLIENT") {
        throw new Error("客户端错误");
      }
      // 2.重试类错误
      // 1.同种错误超过最大重试
      if (
        errorType === "RATE_LIMIT" ||
        errorType === "SERVER" ||
        errorType === "NETWORK"
      ) {
        // 可重试的错误
        // 处理降级的逻辑应该是这样的
        // 1.获取所有当前类型的模型列表
        // 2.如果用户指定了某一个模型，这个时候需要怎么处理
        // 3.同一模型需要sleep，切换模型之后就不需要sleep
        // 4.为了方便处理，我这里处理的逻辑是先获取所有同类型模型 然后将当前使用的模型放在数组模型的第一个这样的话每次都从第一个去循环就解决问题。
        let shouldDrop = true; // 是否应该降级
        const modelList = this.modelList.filter(
          (item) => item.type === this.modelType,
        );
        const curModel = this.model;
        const curIndex = modelList.findIndex(
          (item) => item.id === curModel?.id,
        );
        // 将当前模型放在第一位
        if (curIndex != -1 && curIndex != 0) {
          const [curItem] = modelList.splice(curIndex, 1);
          modelList.unshift(curItem);
        }
        for (let index = 0; index < modelList.length; index++) {
          const model = modelList[index] as modelConfig;
          if (model.disabled) {
            continue; // 跳过循环
          } else {
            for (
              let attempt = 0;
              attempt < this.config.maxRetries!;
              attempt++
            ) {
              try {
                let delay = 0;
                // 首先使用HttpAfterRetry
                // 然后再指数退避+随机抖动
                // 这里不知道怎么获取HttpAfterRetry先下了伪代码
                // 如果是第一个模型才需要去sleep 并且第一个模型只sleep两次 因为前边已经执行过一次了
                // 第二个模型进来的话  就不需要sleep 第二次才去sleep
                if (index === 0 && attempt === 0) {
                  continue;
                }
                if (attempt > 0) {
                  const HttpAfterRetry = false;
                  if (HttpAfterRetry) {
                    delay = 800;
                  } else {
                    delay = calculateDelay(attempt);
                  }
                  await sleep(delay);
                }
                const model = this.getModel();
                await fn(model);
                shouldDrop = false;
                return shouldDrop;
              } catch (error) {
                console.log(error);
              }
            }
            // 跳出循环开启降级
            // 1.找出当前的模型现将当前模型修改为disabled;
            // 2.然后找到下一个模型继续循环
            // 3.如果当前厂商的所有模型都不能用，则将provider修改为disabled
            // 4.找到下一个厂商的首选模型
            if (shouldDrop) {
              model.disabled = true;
              this.handleProvideDisabled(model);
              const nextModel = modelList[index + 1];
              this.getModel(nextModel?.id);
              continue;
            } else {
              return;
            }
          }
        }
        if (shouldDrop) {
          throw Error("无可用模型");
        }
      }
    }
  }

  // 获取所有模型的列表，前端UI展示使用
  public modelListAll() {
    return this.modelList.filter((model) => !model.disabled);
  }
}
