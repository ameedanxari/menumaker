import { describe, expect, it } from '@jest/globals';
import { contextModules, createContextRegistry, routeOwners } from '../src/contexts/index';

describe('context modules', () => {
  it('constructs every context independently with readiness diagnostics', () => {
    for (const module of contextModules) {
      const readiness = module.readiness({});
      expect(readiness.context).toBe(module.name);
      expect(readiness.ready).toBe(false);
      expect(readiness.missingAdapters.length).toBeGreaterThan(0);
    }
  });

  it('provides unique registry entries and route owners', () => {
    const registry = createContextRegistry();
    expect(registry.size).toBe(contextModules.length);
    expect(routeOwners()['/api/v1/orders']).toBe('ordering');
    expect(routeOwners()['/api/v1/payments']).toBe('paymentsBilling');
  });

  it('does not expose mutable repository ownership across contexts', () => {
    const owners = new Map<string, string>();
    for (const module of contextModules) {
      for (const entity of module.owns) {
        expect(owners.get(entity)).toBeUndefined();
        owners.set(entity, module.name);
      }
    }
    expect(owners.get('Order')).toBe('ordering');
    expect(owners.get('Payment')).toBe('paymentsBilling');
  });
});
