import type { ModelErrorType, ModelErrorInterface } from "./types.ts";

// ==================== 公共工具函数 ====================

/** 从 SDK 错误对象中提取厂商的错误详情（兼容多种结构） */
function extractErrorDetail(error: any): { code: string; message: string } {
  // OpenAI 兼容：{ error: { code, message } }
  const nested = error.data?.error;
  if (nested?.code) return { code: nested.code, message: nested.message || "" };

  // AI SDK 的 APICallError：responseBody 是 JSON 字符串
  if (error.responseBody) {
    try {
      const body =
        typeof error.responseBody === "string"
          ? JSON.parse(error.responseBody)
          : error.responseBody;
      if (body.error?.code)
        return { code: body.error.code, message: body.error.message };
    } catch {}
  }

  // 兜底
  return { code: "", message: error.message || "" };
}

/** 检测网络层错误：没有 HTTP 状态码，或连接中断类异常 */
function isNetworkError(error: any): boolean {
  const status = error.statusCode;
  if (status === undefined || status === 0 || status === null) return true;
  const msg = (error.message || "") as string;
  return /ECONNRESET|EPIPE|ETIMEDOUT|timeout|fetch failed|network/i.test(msg);
}

/** 按 HTTP 状态码做第一层分类（三家语义一致） */
function classifyByHttp(error: any): {
  type: ModelErrorType;
  userMessage: string;
  actionable: boolean;
} {
  if (isNetworkError(error)) {
    return {
      type: "NETWORK",
      userMessage: "网络错误，正在自动重试",
      actionable: false,
    };
  }

  const httpStatus: number = error.statusCode || 500;

  if (httpStatus === 401 || httpStatus === 403) {
    return {
      type: "AUTH",
      userMessage: "认证失败，请检查 API Key",
      actionable: true,
    };
  }

  if (httpStatus === 429 || httpStatus === 529) {
    return {
      type: "RATE_LIMIT",
      userMessage: "请求过于频繁，请稍后重试",
      actionable: false,
    };
  }

  if (httpStatus >= 500) {
    return {
      type: "SERVER",
      userMessage: "服务暂时不可用，正在自动重试",
      actionable: false,
    };
  }

  // 其余 4xx
  return { type: "CLIENT", userMessage: "请求参数错误", actionable: true };
}

// ==================== 百炼 (DashScope) ====================

function handleDashScopeError(error: any): ModelErrorInterface {
  const classified = classifyByHttp(error);
  const { code } = extractErrorDetail(error);

  let userMessage = classified.userMessage;
  if (classified.type === "CLIENT") {
    if (code === "insufficient_balance" || code === "account_arrears") {
      userMessage = "API 额度已用完或账户欠费，请前往控制台充值";
    }
  }

  return {
    type: classified.type,
    code,
    httpStatus: error.statusCode || 0,
    origin: error,
    userMessage,
    actionable: classified.actionable,
  };
}

// ==================== DeepSeek ====================

function handleDeepSeekError(error: any): ModelErrorInterface {
  const classified = classifyByHttp(error);
  const { code } = extractErrorDetail(error);

  let userMessage = classified.userMessage;
  if (error.statusCode === 402) {
    userMessage = "API 额度已用完，请前往控制台充值";
  }

  return {
    type: classified.type,
    code,
    httpStatus: error.statusCode || 0,
    origin: error,
    userMessage,
    actionable: classified.actionable,
  };
}

// ==================== 智谱 (GLM) ====================

function handleZhiPuError(error: any): ModelErrorInterface {
  const classified = classifyByHttp(error);
  const { code: bizCode } = extractErrorDetail(error);

  // 业务码覆盖 HTTP 兜底分类
  let type = classified.type;
  let userMessage = classified.userMessage;
  let actionable = classified.actionable;

  switch (bizCode) {
    case "1001":
      type = "AUTH";
      userMessage = "认证失败，请检查 API Key";
      actionable = true;
      break;
    case "1002":
      type = "RATE_LIMIT";
      userMessage = "请求过于频繁，请稍后重试";
      actionable = false;
      break;
    case "1004":
      type = "CLIENT";
      userMessage = "请求参数有误，请检查输入";
      actionable = true;
      break;
    case "1005":
      type = "CLIENT";
      userMessage = "API 额度已用完，请前往控制台充值";
      actionable = true;
      break;
    case "2001":
    case "2002":
      type = "SERVER";
      userMessage = "服务暂时不可用，正在自动重试";
      actionable = false;
      break;
    // 其他业务码不覆盖，保持 HTTP 分类
  }

  return {
    type,
    code: bizCode,
    httpStatus: error.statusCode || 0,
    origin: error,
    userMessage,
    actionable,
  };
}

// ==================== 统一入口 ====================

export function normalizeError(
  provider: string,
  error: any,
): ModelErrorInterface {
  switch (provider) {
    case "dashscope":
      return handleDashScopeError(error);
    case "deepseek":
      return handleDeepSeekError(error);
    case "zhipu":
      return handleZhiPuError(error);
    default: {
      // 兜底：未知厂商按 HTTP 状态码分类
      const classified = classifyByHttp(error);
      return {
        type: classified.type,
        code: "",
        httpStatus: error.statusCode || 0,
        origin: error,
        userMessage: classified.userMessage,
        actionable: classified.actionable,
      };
    }
  }
}
