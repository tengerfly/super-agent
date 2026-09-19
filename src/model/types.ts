// 模型类型枚举
export type modelType =
  | "chat"
  | "embedding"
  | "image"
  | "speech"
  | "transcription"; // transcription 转录

// 厂商列表的数据结构
export type provideConfig = {
  name: string; // 厂商
  displayName: string; // 展示名字
  baseUrl: string; //  url
  apiKey: string; // key
  weight: number; // 权重 数字越小权重越大
  disabled: boolean; // 是否禁用
};

// 模型列表的数据结构
export type modelConfig = {
  provider: string; // 厂商
  id: string; // 模型
  displayName: string; // 模型展示名称
  disabled: boolean; // 是否禁用
  order: number;
  type: modelType; // 模型类型
};

// 用户设置的默认值
export interface ModelManagerOptionsInterface {
  model?: string; // 定义的模型名称
  timeout?: number; // 超时时间
  maxRetries?: number; // 最大重试次数
  maxOutputToken?: number; // 输出的最大值
}

// 定义大模型错误类型
export type ModelErrorType =
  | "AUTH"
  | "CLIENT"
  | "NETWORK"
  | "RATE_LIMIT"
  | "SERVER";

export interface ModelErrorInterface {
  type: ModelErrorType; // 错误类型
  code: string; // 厂商的业务错误信息
  httpStatus: number; // Http状态码
  origin: any; // 原始的错误信息
  userMessage: string; // 给客户的看的错误信息
  actionable: boolean; // 用户能解决的问题，在展示层做处理用
}

// 熔断状态枚举
export type circuitBreakerType = "CLOSED" | "OPEN" | "HALF_OPEN";

// 熔断状态
export interface circuitState {
  status: circuitBreakerType; // 当前状态
  failCount: number; // 失败次数
  lastFailTime: string; // 最后一次失败时间
}
