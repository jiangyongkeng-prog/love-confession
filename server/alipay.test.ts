import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Alipay Payment Integration', () => {
  it('should create a recharge with alipay method', async () => {
    const userId = 1;
    const amount = '100.00';
    const method = 'alipay';

    const rechargeId = await db.createRecharge(userId, amount, method);
    expect(rechargeId).toBeDefined();
    expect(typeof rechargeId).toBe('number');
  });

  it('should get pending recharges for a user', async () => {
    const userId = 1;
    const amount = '50.00';

    // Create a recharge with alipay method
    const rechargeId = await db.createRecharge(userId, amount, 'alipay');

    // Get pending recharges
    const pendingRecharges = await db.getPendingRechargesByUser(userId);
    expect(Array.isArray(pendingRecharges)).toBe(true);
    expect(pendingRecharges.length).toBeGreaterThan(0);

    // Verify the recharge status is pending and method is alipay
    const recharge = pendingRecharges.find((r: any) => r.id === rechargeId);
    expect(recharge).toBeDefined();
    expect(recharge?.status).toBe('pending');
    expect(recharge?.method).toBe('alipay');
  });

  it('should complete a recharge', async () => {
    const userId = 1;
    const amount = '75.00';

    // Create a recharge
    const rechargeId = await db.createRecharge(userId, amount, 'alipay');

    // Complete the recharge
    await db.completeRecharge(rechargeId);

    // Verify it's completed
    const recharges = await db.getRechargesByUser(userId);
    const completed = recharges.find((r: any) => r.id === rechargeId);
    expect(completed?.status).toBe('completed');
    expect(completed?.completedAt).toBeDefined();
  });

  it('should filter pending recharges correctly', async () => {
    const userId = 2;
    const amount1 = '100.00';
    const amount2 = '200.00';

    // Create two recharges
    const rechargeId1 = await db.createRecharge(userId, amount1, 'alipay');
    const rechargeId2 = await db.createRecharge(userId, amount2, 'alipay');

    // Complete one of them
    await db.completeRecharge(rechargeId1);

    // Get pending recharges - should only have the incomplete one
    const pendingRecharges = await db.getPendingRechargesByUser(userId);
    const pendingIds = pendingRecharges.map((r: any) => r.id);

    expect(pendingIds).toContain(rechargeId2);
    expect(pendingIds).not.toContain(rechargeId1);
  });

  it('should store alipay method correctly', async () => {
    const userId = 3;
    const amount = '150.00';

    const rechargeId = await db.createRecharge(userId, amount, 'alipay');
    const recharges = await db.getRechargesByUser(userId);
    const recharge = recharges.find((r: any) => r.id === rechargeId);

    expect(recharge?.method).toBe('alipay');
    expect(recharge?.amount).toBe(amount);
  });
});
