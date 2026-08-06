/**
 * antd message 全局代理
 *
 * antd v5 的静态 message.success() 等方法无法消费 React Context（动态主题/ConfigProvider），
 * 控制台会输出警告："Static function can not consume context like dynamic theme. Please use 'App' component instead."
 *
 * 本模块创建一个全局代理：在 App.tsx 中用 antd <App> 组件包裹应用，
 * 通过 AppMessageBinder 组件用 App.useApp() 获取动态 message 实例并绑定到全局变量。
 * 各业务文件改为 `import { message } from '@/lib/antdMessage'` 即可使用动态实例，
 * 消除控制台警告且获得主题联动能力。
 */
import type { MessageInstance } from 'antd/es/message/interface';

let messageInstance: MessageInstance | null = null;

/** 由 AppMessageBinder 在 App mount 时调用，绑定动态 message 实例 */
export function bindMessageInstance(instance: MessageInstance): void {
  messageInstance = instance;
}

/**
 * 全局 message 代理。
 * 转发到 App.useApp() 获取的动态实例，调用时机均在用户事件回调中（App 已 mount）。
 */
export const message: MessageInstance = new Proxy({} as MessageInstance, {
  get(_target, prop: string) {
    const method = messageInstance?.[prop as keyof MessageInstance];
    if (typeof method === 'function') {
      return method.bind(messageInstance);
    }
    // App 未 mount 时的兜底（静默失败，避免崩溃）
    return () => {};
  },
});
