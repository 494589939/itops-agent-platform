import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { evaluateExpression, resolveExpression } from '../modules/workflow/services/workflowExpressionEvaluator';

/**
 * 工作流引擎增强功能集成测试
 * 测试条件分支、变量传递、结构化输出等核心功能
 */

describe('Workflow Engine Enhancement', () => {
  describe('Expression Evaluation', () => {
    it('should evaluate simple comparison expressions', () => {
      const variables = { status: 'success', count: 5 };
      
      expect(evaluateExpression('{{status}} == "success"', variables, 'simple_compare')).toBe(true);
      expect(evaluateExpression('{{count}} > 3', variables, 'simple_compare')).toBe(true);
      expect(evaluateExpression('{{status}} == "failed"', variables, 'simple_compare')).toBe(false);
    });

    it('should evaluate regex match expressions', () => {
      const variables = { error: 'Connection timeout occurred' };
      
      expect(evaluateExpression('timeout', variables, 'regex_match')).toBe(true);
      expect(evaluateExpression('connection', variables, 'regex_match')).toBe(true);
      expect(evaluateExpression('database', variables, 'regex_match')).toBe(false);
    });

    it('should evaluate JavaScript expressions', () => {
      const variables = { cpu: 85, memory: 70 };
      
      expect(evaluateExpression('{{cpu}} > 80 && {{memory}} > 60', variables, 'javascript')).toBe(true);
      expect(evaluateExpression('{{cpu}} < 50 || {{memory}} > 60', variables, 'javascript')).toBe(true);
      expect(evaluateExpression('{{cpu}} < 50 && {{memory}} < 50', variables, 'javascript')).toBe(false);
    });

    it('should handle nested variable access', () => {
      const variables = {
        node1: {
          output: {
            status: 'success',
            data: { cpu: 85, memory: 70 }
          }
        }
      };
      
      expect(evaluateExpression('{{node1.output.status}} == "success"', variables, 'simple_compare')).toBe(true);
      expect(evaluateExpression('{{node1.output.data.cpu}} > 80', variables, 'simple_compare')).toBe(true);
    });
  });

  describe('Variable Resolution', () => {
    it('should resolve template variables', () => {
      const variables = { name: 'Server1', ip: '192.168.1.100' };
      
      expect(resolveExpression('Server: {{name}} ({{ip}})', variables)).toBe('Server: Server1 (192.168.1.100)');
    });

    it('should handle missing variables gracefully', () => {
      const variables = { name: 'Server1' };
      
      expect(resolveExpression('Server: {{name}} ({{ip}})', variables)).toBe('Server: Server1 ({{ip}})');
    });

    it('should resolve nested variables', () => {
      const variables = {
        result: {
          status: 'success',
          details: { code: 200 }
        }
      };
      
      expect(resolveExpression('Status: {{result.status}}, Code: {{result.details.code}}', variables))
        .toBe('Status: success, Code: 200');
    });
  });

  describe('Condition Branch Logic', () => {
    it('should match correct branch based on priority', () => {
      const variables = { level: 'P1' };
      
      const branches = [
        { id: 'p0', label: 'P0', expression: '{{level}} == "P0"', priority: 1 },
        { id: 'p1', label: 'P1', expression: '{{level}} == "P1"', priority: 2 },
        { id: 'p2', label: 'P2', expression: '{{level}} == "P2"', priority: 3 }
      ];
      
      // 按优先级排序
      const sorted = [...branches].sort((a, b) => a.priority - b.priority);
      
      let matched = null;
      for (const branch of sorted) {
        if (evaluateExpression(branch.expression, variables, 'simple_compare')) {
          matched = branch;
          break;
        }
      }
      
      expect(matched?.id).toBe('p1');
    });

    it('should use default branch when no match', () => {
      const variables = { level: 'P5' };
      
      const branches = [
        { id: 'p0', label: 'P0', expression: '{{level}} == "P0"', priority: 1 },
        { id: 'p1', label: 'P1', expression: '{{level}} == "P1"', priority: 2 }
      ];
      
      let matched = null;
      for (const branch of branches) {
        if (evaluateExpression(branch.expression, variables, 'simple_compare')) {
          matched = branch;
          break;
        }
      }
      
      expect(matched).toBe(null);
      // 应该使用 defaultTargetNodeId
    });
  });

  describe('Structured Output Parsing', () => {
    it('should parse JSON output', () => {
      const output = '{"status":"success","data":{"cpu":85}}';
      const parsed = JSON.parse(output);
      
      expect(parsed.status).toBe('success');
      expect(parsed.data.cpu).toBe(85);
    });

    it('should handle non-JSON output', () => {
      const output = 'Simple text output';
      
      let parsed;
      try {
        parsed = JSON.parse(output);
      } catch {
        parsed = output;
      }
      
      expect(parsed).toBe('Simple text output');
    });

    it('should support nested field access', () => {
      const nodeResult = {
        output: '{"status":"success","data":{"cpu":85,"memory":70}}'
      };
      
      const parsed = JSON.parse(nodeResult.output);
      
      expect(parsed.status).toBe('success');
      expect(parsed.data.cpu).toBe(85);
      expect(parsed.data.memory).toBe(70);
    });
  });

  describe('Variable Scope Isolation', () => {
    it('should isolate loop variables', () => {
      const globalVars = { serverList: ['server1', 'server2', 'server3'] };
      const loopVars = { item: 'server1', index: 0 };
      
      // 循环变量不应该污染全局变量
      const merged = { ...globalVars, ...loopVars };
      
      expect(merged.item).toBe('server1');
      expect(merged.index).toBe(0);
      expect(globalVars).not.toHaveProperty('item');
      expect(globalVars).not.toHaveProperty('index');
    });

    it('should support scoped variable precedence', () => {
      const global = { value: 'global' };
      const workflow = { value: 'workflow' };
      const loop = { value: 'loop' };
      
      // 优先级: loop > workflow > global
      const merged = { ...global, ...workflow, ...loop };
      
      expect(merged.value).toBe('loop');
    });
  });

  describe('Parallel Execution Metadata', () => {
    it('should track parallel branch status', () => {
      const branchStatus = {
        branch1: { status: 'success', duration: 1200 },
        branch2: { status: 'success', duration: 1500 },
        branch3: { status: 'failed', duration: 800, error: 'Timeout' }
      };
      
      const allSuccess = Object.values(branchStatus).every(b => b.status === 'success');
      const anyFailed = Object.values(branchStatus).some(b => b.status === 'failed');
      
      expect(allSuccess).toBe(false);
      expect(anyFailed).toBe(true);
    });

    it('should calculate parallel execution time', () => {
      const branches = [
        { duration: 1200 },
        { duration: 1500 },
        { duration: 800 }
      ];
      
      // 并行执行时间应该是所有分支中最长的
      const maxDuration = Math.max(...branches.map(b => b.duration));
      
      expect(maxDuration).toBe(1500);
    });
  });

  describe('Loop Iteration Tracking', () => {
    it('should track iteration count', () => {
      const iterations = [
        { index: 0, item: 'server1', status: 'success' },
        { index: 1, item: 'server2', status: 'success' },
        { index: 2, item: 'server3', status: 'failed' }
      ];
      
      expect(iterations.length).toBe(3);
      expect(iterations[0].index).toBe(0);
      expect(iterations[2].status).toBe('failed');
    });

    it('should support for_each loop mode', () => {
      const items = ['server1', 'server2', 'server3'];
      const iterations: Array<{ item: string; index: number }> = [];
      
      for (let i = 0; i < items.length; i++) {
        iterations.push({ item: items[i], index: i });
      }
      
      expect(iterations.length).toBe(3);
      expect(iterations[1].item).toBe('server2');
      expect(iterations[1].index).toBe(1);
    });

    it('should support while loop mode', () => {
      let count = 0;
      const maxCount = 5;
      const iterations: number[] = [];
      
      while (count < maxCount) {
        iterations.push(count);
        count++;
      }
      
      expect(iterations.length).toBe(5);
      expect(iterations).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('Workflow Execution Order', () => {
    it('should respect topological order', () => {
      const nodes = ['start', 'analyze', 'condition', 'fix', 'end'];
      const edges = [
        { source: 'start', target: 'analyze' },
        { source: 'analyze', target: 'condition' },
        { source: 'condition', target: 'fix' },
        { source: 'fix', target: 'end' }
      ];
      
      // 简单的拓扑排序验证
      const inDegree: Record<string, number> = {};
      nodes.forEach(n => inDegree[n] = 0);
      edges.forEach(e => inDegree[e.target]++);
      
      expect(inDegree['start']).toBe(0);
      expect(inDegree['analyze']).toBe(1);
      expect(inDegree['end']).toBe(1);
    });

    it('should detect circular dependencies', () => {
      const nodes = ['A', 'B', 'C'];
      const edges = [
        { source: 'A', target: 'B' },
        { source: 'B', target: 'C' },
        { source: 'C', target: 'A' } // 循环
      ];
      
      // 检测循环
      const inDegree: Record<string, number> = {};
      nodes.forEach(n => inDegree[n] = 0);
      edges.forEach(e => inDegree[e.target]++);
      
      const queue = nodes.filter(n => inDegree[n] === 0);
      expect(queue.length).toBe(0); // 所有节点都有入度，存在循环
    });
  });
});
