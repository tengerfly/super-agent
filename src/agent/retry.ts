// 错误分类
// 根据错误类型判断是否可以重试
export function isRetryable(error: unknown) {
  if (error instanceof Error) {
    const message = error.message || "";
    // 从错误消息中获取状态码
    const statusMatch = message.match(/(\d{3})/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      console.log("当前的状态为", status);
      // 根据状态码判断是否可以重试
      if ([429, 529, 408].includes(status)) return true;
      if (status >= 500 && status < 600) return true;
      if (status >= 400 && status < 500) return false;
    }
    // ECONNRESET
    if (message.includes("ECONNRESET") || message.includes("EPIPE"))
      return true;
    if (message.includes("ETIMEDOUT") || message.includes("timeout"))
      return true;
    if (message.includes("fetch failed") || message.includes("network"))
      return true;
    if (message.includes("No output generated")) return true;
  } else {
    return false;
  }
}

// --- 指数退避 + 随机抖动 ---
// 计算延时时间
export function calculateDelay(
  attempt: number,
  baseMs = 500,
  maxMs = 30000,
): number {
  const exponential = baseMs * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, maxMs); // 获取在限度范围内的值
  const jitterRange = capped * 0.25; // 随机范围 主要是用来分散请求
  const jittered = capped + (Math.random() * 2 - 1) * jitterRange;
  return Math.max(0, Math.round(jittered));
}

// 延时
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
