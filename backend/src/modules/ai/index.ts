/**
 * AI 智能运维模块
 * 
 * 职责：多Agent协作、LLM调用、根因分析、知识库、Provider生态
 * 依赖：auth（认证）、alerts（告警触发）
 */

// 路由
export { default as routes } from './routes';

// 公开服务
export { executeTask } from './services/multiAgent';
export { providerRegistry } from './services/providers';
