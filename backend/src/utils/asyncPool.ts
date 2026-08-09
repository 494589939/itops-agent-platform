/**
 * 通用并发池：以固定并发数执行异步任务，保持输入顺序返回结果。
 * 用于批量 SSH 命令等场景（如 50 台服务器、并发 5，分批执行不压垮连接池）。
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const safeLimit = Math.max(1, Math.min(limit, items.length));
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  };

  await Promise.all(Array.from({ length: safeLimit }, () => worker()));
  return results;
}
