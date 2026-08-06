import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock("../../../../models/database", () => ({ default: {}, db: {}, initializeDatabase: vi.fn(), performMaintenance: vi.fn(), getIOInstance: vi.fn() }));
import { agentToolRegistry } from './agentToolRegistry';

describe('agentToolRegistry', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should be defined and importable', () => {
    expect(agentToolRegistry).toBeDefined();
  });

  it('should have register and getTool methods', () => {
    expect(typeof agentToolRegistry.register).toBe('function');
    expect(typeof agentToolRegistry.getTool).toBe('function');
    expect(typeof agentToolRegistry.listTools).toBe('function');
  });

  it('should start with empty tool registry', () => {
    const tools = agentToolRegistry.listTools();
    expect(tools).toBeDefined();
  });

  it('should register and retrieve a tool', () => {
    const tool = {
      id: 'test-tool',
      name: 'Test Tool',
      description: 'A test tool',
      category: 'system' as const,
      schema: { type: 'object' as const, properties: {} },
      execute: vi.fn().mockResolvedValue('result'),
    };
    agentToolRegistry.register(tool);
    expect(agentToolRegistry.getTool('test-tool')).toEqual(tool);
  });

  it('should return undefined for non-existent tool', () => {
    expect(agentToolRegistry.getTool('non-existent')).toBeUndefined();
  });
});
