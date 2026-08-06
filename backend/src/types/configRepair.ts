/**
 * =============================================================================
 * 配置文件自动修复 - 类型定义
 * =============================================================================
 */

// 配置文件模板
export interface ConfigTemplate {
  id: string;
  name: string;
  path: string;
  parser: 'nginx' | 'sysctl' | 'sshd' | 'mysql' | 'custom';
  validator?: string;
  reloadCmd?: string;
  backupDir: string;
  description: string;
  isPreset: boolean;
}

// 配置文件内容块
export interface ConfigBlock {
  id: string;
  type: 'block' | 'keyValue' | 'comment' | 'empty';
  lineNumber: number;
  rawContent: string;
  key?: string;
  value?: string;
  children?: ConfigBlock[];
  parentId?: string;
  indentLevel: number;
}

// 配置问题
export interface ConfigIssue {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'syntax' | 'performance' | 'security' | 'bestPractice';
  rule: string;
  description: string;
  lineNumber?: number;
  key?: string;
  currentValue?: string;
  suggestedValue?: string;
  fixable: boolean;
}

// 修复方案
export interface RepairPlan {
  id: string;
  configPath: string;
  issues: ConfigIssue[];
  changes: ConfigChange[];
  riskLevel: 'low' | 'medium' | 'high';
  estimatedImpact: string;
  rollbackAvailable: boolean;
}

// 配置变更
export interface ConfigChange {
  id: string;
  type: 'modify' | 'add' | 'delete';
  lineNumber?: number;
  key?: string;
  oldValue?: string;
  newValue?: string;
  blockPath?: string;
  description: string;
}

// 修复执行记录
export interface RepairRecord {
  id: string;
  configPath: string;
  deviceId: string;
  deviceName: string;
  deviceIp: string;
  repairPlan: RepairPlan;
  status: 'pending' | 'waiting_approval' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed' | 'rolled_back';
  backupId?: string;
  executionResult?: string;
  errorMessage?: string;
  approver?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// 备份记录
export interface BackupRecord {
  id: string;
  configPath: string;
  deviceId: string;
  deviceName: string;
  backupPath: string;
  fileSize: number;
  checksum: string;
  createdAt: string;
}

// 配置分析结果
export interface ConfigAnalysis {
  path: string;
  blocks: ConfigBlock[];
  issues: ConfigIssue[];
  summary: {
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    fixable: number;
  };
}

// API 请求/响应类型
export interface AnalyzeConfigRequest {
  deviceId: string;
  configPath: string;
  templateId?: string;
}

export interface AnalyzeConfigResponse {
  success: boolean;
  data?: ConfigAnalysis;
  error?: string;
}

export interface GenerateRepairPlanRequest {
  deviceId: string;
  configPath: string;
  issueIds: string[];
}

export interface GenerateRepairPlanResponse {
  success: boolean;
  data?: RepairPlan;
  error?: string;
}

export interface ExecuteRepairRequest {
  repairPlanId: string;
  approve?: boolean;
}

export interface ExecuteRepairResponse {
  success: boolean;
  data?: { recordId: string; status: string };
  error?: string;
}

export interface RollbackRepairRequest {
  recordId: string;
}

export interface RollbackRepairResponse {
  success: boolean;
  message?: string;
  error?: string;
}
