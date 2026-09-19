// 定义工具接口
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  isConcurrencySafe?: boolean; // 是否可以安全并行
  isReadonly?: boolean; // 是否只读操作
  maxResultChars?: number; // 结果返回的最大token
  execute: (input: any) => Promise<unknown>;
  profile?: string[]; // 角色
  shouldDefer?: boolean; // 是否异步
  searchHint?: string; // 搜索引擎的搜索关键词
}
