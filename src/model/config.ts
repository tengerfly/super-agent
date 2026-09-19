import type { modelConfig, provideConfig } from "./types.ts";
import "dotenv/config";

// 厂商列表
export const providerList: provideConfig[] = [
  // {
  //   name: "dashscope",
  //   displayName: "阿里百炼",
  //   weight: 1,
  //   disabled: false,
  //   baseUrl: process.env.DASH_SCOPE_BASE_URL as string,
  //   apiKey: process.env.DASH_SCOPE_API_KEY as string,
  // },
  {
    name: "dashscope",
    displayName: "阿里百炼",
    weight: 1,
    disabled: false,
    baseUrl: process.env.DASH_SCOPE_BASE_URL as string,
    apiKey: process.env.DASH_SCOPE_API_KEY as string,
  },
  {
    name: "deepseek",
    displayName: "DeepSeek",
    weight: 2,
    disabled: false,
    baseUrl: process.env.DEEP_SEEK_BASE_URL as string,
    apiKey: process.env.DEEP_SEEK_API_KEY as string,
  },
];

export const modelList: modelConfig[] = [
  // 阿里百炼
  {
    provider: "dashscope",
    id: "qwen-max",
    displayName: "QWen-Max",
    disabled: false,
    order: 1,
    type: "chat",
  },
  {
    provider: "dashscope",
    id: "qwen-plus",
    displayName: "QWen-Plus",
    disabled: false,
    order: 2,
    type: "chat",
  },
  // deepseek
  {
    id: "deepseek-v4-pro",
    provider: "deepseek",
    type: "chat",
    order: 1,
    displayName: "DeepSeek V4 Pro",
    disabled: false,
  },
  {
    id: "deepseek-v4-flash",
    provider: "deepseek",
    type: "chat",
    order: 2,
    displayName: "DeepSeek V4 Flash",
    disabled: false,
  },
];
