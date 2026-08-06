
// 统一告警处理类型定义

export type ProcessingStrategy = 'aars' | 'workflow' | 'hybrid' | 'auto';

export interface AlertProcessingContext {
  alertId: string;
  title: string;
  content?: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  source: string;
  metadata?: Record<string, unknown>;
  deviceId?: string;
  deviceType?: 'server' | 'network_device';
}

export interface ProcessingDecision {
  strategy: ProcessingStrategy;
  reason: string;
  workflowId?: string;
  aarsFallback?: boolean;
}

export interface ProcessingResult {
  success: boolean;
  strategy: ProcessingStrategy;
  executionId?: string;
  taskId?: string;
  errorMessage?: string;
  aarsLogId?: string;
  remediationId?: string;
}
