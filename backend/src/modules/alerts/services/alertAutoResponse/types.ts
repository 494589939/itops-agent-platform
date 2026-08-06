/**
 * =============================================================================
 * AARS v2 — 自适应告警响应系统 类型定义
 * =============================================================================
 */

// ── 设备画像 ──

export type DeviceCategory = 'server' | 'network_device' | 'unknown';

export interface DeviceRuntimeProfile {
  deviceId: string;
  type: DeviceCategory;
  ip: string;
  hostname: string;
  accessMethod: 'ssh' | 'snmp' | 'both' | 'none';
  /** 动态属性（实时探测缓存） */
  osFamily?: 'linux' | 'windows' | 'network_os' | 'unknown';
  osVersion?: string;
  runningServices?: string[];
  kernelVersion?: string;
  /** 网络设备特性 */
  deviceCategory?: 'switch' | 'router' | 'firewall' | 'loadbalancer' | 'ap' | 'unknown';
  snmpVersion?: 'v1' | 'v2c' | 'v3';
  /** 多源融合置信度 (0~1) */
  identificationConfidence: number;
  /** 历史行为基线 */
  baseline?: MetricsBaseline;
}

export interface MetricsBaseline {
  cpuAvg: number;         // 7 天平均 CPU%
  cpuStddev: number;
  memAvg: number;         // 7 天平均 MEM%
  memStddev: number;
  diskAvg: Record<string, number>;
  trafficDailyAvg: number;
  responseTimeAvg: number;
  timestamp: number;       // 最后更新时间戳
}

// ── 探针单元 ──

export type ProbeRisk = 'readonly' | 'low_impact' | 'medium_impact' | 'high_impact';

export interface ProbeUnit {
  id: string;
  name: string;
  description: string;
  applicableOS: string[];
  risk: ProbeRisk;
  /** SSH 命令（SSH 设备用） */
  commands?: string[];
  /** SNMP OID（网络设备用） */
  oids?: string[];
  /** 预期输出解析器 */
  parser?: 'raw' | 'json' | 'table' | 'keyvalue';
  /** 该探针的信息熵权重（越大越有价值） */
  infoGainWeight: number;
  /** 执行超时（ms） */
  timeoutMs: number;
  enabled: boolean;
}

// ── 探针执行结果 ──

export interface ProbeResult {
  probeId: string;
  success: boolean;
  rawOutput: string;
  parsed?: Record<string, unknown>;
  durationMs: number;
  error?: string;
}

// ── 风险评分 ──

export interface RiskAssessment {
  overallRiskScore: number;           // 0~1, 1=最高风险
  dimensions: RiskDimensions;
  suggestedAction: 'auto_execute' | 'require_approval' | 'manual_only' | 'escalate';
  thresholds: DynamicThresholds;
}

export interface RiskDimensions {
  operationalRisk: {
    score: number;
    factors: {
      isReadonly: boolean;
      requiresServiceRestart: boolean;
      requiresMachineReboot: boolean;
      modifiesConfig: boolean;
      deletesData: boolean;
      mayCauseDowntime: boolean;
    };
  };
  urgencyScore: {
    score: number;
    factors: {
      severity: string;
      isWeekendOrNight: boolean;
      affectedUsersCount: number;
      isDownstreamDependency: boolean;
    };
  };
  confidenceScore: {
    score: number;
    factors: {
      rootCauseCertainty: number;
      similarCaseExists: boolean;
      similarCaseSuccess: 'high' | 'mid' | 'low' | 'none';
      remediationTested: boolean;
      multipleEvidenceLines: boolean;
    };
  };
}

export interface DynamicThresholds {
  autoThreshold: number;    // 低于此分自动执行
  approveThreshold: number; // 低于此分需审核
  manualThreshold: number;  // 高于此分转人工
}

// ── 自适应自动化信任记录 ──

export interface TrustRecord {
  operationKey: string;
  approvalCount: number;
  rejectionCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  lastUpdated: number;
}

// ── 验证门禁 ──

export type VerificationStage =
  | 'command_success'
  | 'service_health'
  | 'metric_recovery'
  | 'baseline_comparison'
  | 'impact_assessment';

export type VerificationResult = 'passed' | 'failed' | 'partially_passed_with_warning';

export interface VerificationGateConfig {
  stage: VerificationStage;
  required: boolean;
  maxRetries: number;
  retryIntervalSec: number;
  timeoutSec: number;
}

export interface VerificationChainResult {
  result: VerificationResult;
  stages: Array<{
    stage: VerificationStage;
    passed: boolean;
    skipped: boolean;
    detail: string;
  }>;
  failedStage: VerificationStage | null;
  diagnosticAfterRemediation: string;
}

// ── 修复计划 ──

export interface RemediationPlan {
  commands: RemediationCommand[];
  rollbackCommands: RemediationCommand[];
  summary: string;
  risk: RiskAssessment;
  requiresApproval: boolean;
}

export interface RemediationCommand {
  command: string;
  description: string;
  timeoutMs: number;
  allowFailure: boolean;
}

// ── 执行日志 ──

export type ResponseLogStatus =
  | 'identifying'
  | 'diagnosing'
  | 'analyzing'
  | 'pending_approval'
  | 'executing'
  | 'verifying'
  | 'resolved'
  | 'failed'
  | 'escalated';

export interface AlertResponseLog {
  id: string;
  alertId: string;
  deviceProfile?: DeviceRuntimeProfile;
  deviceType: DeviceCategory;
  accessMethod: 'ssh' | 'snmp' | 'none';
  status: ResponseLogStatus;
  probesUsed: ProbeResult[];
  diagnosisResult: string;
  rootCause?: string;
  remediationPlan?: RemediationPlan;
  verificationResult?: VerificationChainResult;
  executionStatus: string;
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'timedout' | 'not_needed';
  notificationSent: boolean;
  errorMessage?: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ── 调度器 ──

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface ScheduledTaskConfig {
  alertId: string;
  priority: PriorityLevel;
  severity: string;
  createdAt: number;
  estimatedDurationMs: number;
}

export interface ResourceConstraints {
  sshConnPool: { maxTotal: number; maxPerHost: number };
  snmpRateLimit: { maxRequests: number; windowMs: number };
  llmConcurrency: number;
}

// ── 配置 ──

export interface AutoResponseConfig {
  enabled: boolean;
  minSeverity: string;
  autoExecuteEnabled: boolean;
  approvalTimeoutMinutes: number;
  maxConcurrent: number;
  sshTimeoutSec: number;
  verifyIntervalSec: number;
  notificationChannels: string[];
  autoExecuteWhitelist: string[];
  businessHours: { start: string; end: string };
}

// ── 诊断结果类型 ──

export interface SshDiagnosisResult {
  probeResults: ProbeResult[];
  rawOutput: string;
  diagnosis: string;
  summary: string;
  rootCause: string;
  remediationPlan: RemediationPlan;
  riskAssessment: RiskAssessment;
  durationMs: number;
}

export interface SnmpDiagnosisResult {
  probeResults: ProbeResult[];
  rawOutput: string;
  diagnosis: string;
  summary: string;
  rootCause: string;
  findings: string[];
  recommendations: string[];
  hasCriticalIssues: boolean;
  durationMs: number;
}
