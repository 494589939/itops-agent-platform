/**
 * Phase 1: 工作流增强节点类型定义
 * 将 AARS 的核心能力移植为工作流标准节点类型
 */

// ── verification 节点：5级验证门禁链 ──
export type VerificationStage =
  | 'command_success'
  | 'service_health'
  | 'metric_recovery'
  | 'baseline_comparison'
  | 'impact_assessment';

export interface VerificationStageConfig {
  stage: VerificationStage;
  required: boolean;
  maxRetries: number;
  retryIntervalSec: number;
  timeoutSec: number;
}

export interface VerificationNodeConfig {
  /** 要执行的验证阶段列表，默认全部5级 */
  gates?: VerificationStage[];
  /** SSH 连接目标服务器ID */
  server_id?: string;
  /** 自定义各阶段参数 */
  stageOverrides?: Partial<Record<VerificationStage, Partial<VerificationStageConfig>>>;
  /** 验证超时(ms)，默认 300000 */
  timeout?: number;
}

// ── risk_assess 节点：三维风险量化评分 ──
export interface RiskDimensions {
  operationalRisk: {
    score: number;
    factors: Record<string, { triggered: boolean; weight: number }>;
  };
  urgencyScore: number;
  confidenceScore: number;
}

export interface RiskAssessmentResult {
  overallRiskScore: number; // 0~1, 越低越安全
  dimensions: RiskDimensions;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  suggestedAction: 'auto_execute' | 'require_approval' | 'manual_only' | 'escalate';
  detail: string;
}

export interface RiskAssessNodeConfig {
  /** 风险评估输入来源：从哪个节点的输出中提取修复计划 */
  planSourceNodeId?: string;
  /** 告警严重程度（可从变量注入） */
  alertSeverity?: string;
  /** 告警标题（可从变量注入） */
  alertTitle?: string;
  /** 自定义阈值 */
  thresholds?: {
    auto?: number;    // 默认 0.35
    approve?: number; // 默认 0.65
    manual?: number;  // 默认 0.85
  };
}

// ── decision 节点：自适应决策引擎 ──
export type DecisionAction = 'auto_execute' | 'request_approval' | 'escalate_to_human' | 'block';

export interface DecisionRule {
  /** 条件表达式，支持 risk_score / risk_level */
  condition: string;
  /** 匹配时的动作 */
  action: DecisionAction;
  /** 动作说明 */
  description?: string;
}

export interface DecisionNodeConfig {
  /** 决策规则列表（从上到下匹配，首个命中生效） */
  rules: DecisionRule[];
  /** 风险评估来源节点ID */
  riskSourceNodeId?: string;
  /** 默认动作（无规则命中时） */
  defaultAction?: DecisionAction;
}

// ── knowledge 节点：知识沉淀闭环 ──
export interface KnowledgeNodeConfig {
  /** 知识类别 */
  category?: string;
  /** 知识标题模板 */
  titleTemplate?: string;
  /** 是否去重（默认 true） */
  deduplicate?: boolean;
  /** 去重相似度阈值 (0~1, 默认 0.7) */
  similarityThreshold?: number;
}

// ── rollback 节点：自动回滚 ──
export interface RollbackNodeConfig {
  /** 回滚命令来源节点ID */
  commandSourceNodeId?: string;
  /** 服务器ID */
  server_id?: string;
  /** 每条命令的超时(ms)，默认 30000 */
  commandTimeout?: number;
  /** 回滚后是否重新验证 */
  verifyAfterRollback?: boolean;
}

// ── 增强节点类型汇总 ──
export type EnhancedNodeType = 
  | 'verification'
  | 'risk_assess'
  | 'decision'
  | 'knowledge'
  | 'rollback';

export const ENHANCED_NODE_TYPES: EnhancedNodeType[] = [
  'verification',
  'risk_assess',
  'decision',
  'knowledge',
  'rollback'
];

// ── 节点配置类型映射 ──
export interface EnhancedNodeConfigMap {
  verification: VerificationNodeConfig;
  risk_assess: RiskAssessNodeConfig;
  decision: DecisionNodeConfig;
  knowledge: KnowledgeNodeConfig;
  rollback: RollbackNodeConfig;
}
