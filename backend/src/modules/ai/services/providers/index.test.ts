import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger since ProviderRegistry uses it
vi.mock("../../../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

import {
  ProviderRegistry,
  providerRegistry,
  initializeProviders,
} from './index';
import type { Provider } from './types';

describe('Providers Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('index exports', () => {
    it('should export ProviderRegistry class', () => {
      expect(ProviderRegistry).toBeDefined();
    });

    it('should export providerRegistry singleton', () => {
      expect(providerRegistry).toBeDefined();
    });

    it('should export initializeProviders function', () => {
      expect(typeof initializeProviders).toBe('function');
    });
  });

  describe('ProviderRegistry', () => {
    let registry: ProviderRegistry;

    beforeEach(() => {
      registry = new ProviderRegistry();
    });

    it('should create an instance', () => {
      expect(registry).toBeDefined();
    });

    it('should register a provider', () => {
      const provider: Provider = {
        name: 'test-provider',
        version: '1.0.0',
        description: 'Test provider',
        methods: [],
      };
      registry.register(provider);
      expect(registry.get('test-provider')).toEqual(provider);
    });

    it('should register a provider with implementation', () => {
      const provider: Provider = {
        name: 'impl-provider',
        version: '1.0.0',
        description: 'Provider with impl',
        methods: [],
      };
      const impl = { execute: vi.fn() };
      registry.register(provider, impl);
      expect(registry.get('impl-provider')).toEqual(provider);
      expect(registry.getImplementation('impl-provider')).toEqual(impl);
    });

    it('should return undefined for unregistered provider', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });

    it('should get all registered providers', () => {
      const p1: Provider = { name: 'p1', version: '1.0', description: 'P1', methods: [] };
      const p2: Provider = { name: 'p2', version: '1.0', description: 'P2', methods: [] };
      registry.register(p1);
      registry.register(p2);
      expect(registry.getAll()).toHaveLength(2);
    });
  });
});
