import { describe, expect, it } from "vitest";
import * as db from "./db";

describe("orders database functions", () => {
  it("should create an order", async () => {
    const orderId = await db.createOrder(
      1,
      "做一顿浪漫晚餐",
      "做一顿法式晚餐",
      "task",
      "100.00"
    );

    expect(orderId).toBeDefined();
    expect(typeof orderId).toBe("number");
  });

  it("should get order by id", async () => {
    const orderId = await db.createOrder(
      2,
      "点菜",
      "红烧肉",
      "dish",
      "50.00"
    );

    const order = await db.getOrderById(orderId);

    expect(order).toBeDefined();
    expect(order?.id).toBe(orderId);
    expect(order?.title).toBe("点菜");
    expect(order?.customerId).toBe(2);
  });

  it("should get orders by customer", async () => {
    await db.createOrder(3, "拖地", "拖客厅", "task", "30.00");
    await db.createOrder(3, "洗碗", "洗晚餐的碗", "task", "20.00");

    const orders = await db.getOrdersByCustomer(3);

    expect(Array.isArray(orders)).toBe(true);
    expect(orders.length).toBeGreaterThanOrEqual(2);
    expect(orders.every((o) => o.customerId === 3)).toBe(true);
  });

  it("should get pending orders", async () => {
    await db.createOrder(4, "做早餐", "做一顿丰盛的早餐", "task", "80.00");

    const pending = await db.getPendingOrders();

    expect(Array.isArray(pending)).toBe(true);
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.some((o) => o.status === "pending")).toBe(true);
  });

  it("should update order status", async () => {
    const orderId = await db.createOrder(
      5,
      "看电影",
      "看一场浪漫的电影",
      "activity",
      "100.00"
    );

    await db.updateOrderStatus(orderId, "accepted");
    const order = await db.getOrderById(orderId);

    expect(order?.status).toBe("accepted");
  });

  it("should accept order", async () => {
    const orderId = await db.createOrder(
      6,
      "做饭",
      "做一顿家常饭",
      "task",
      "60.00"
    );

    await db.acceptOrder(orderId, 7);
    const order = await db.getOrderById(orderId);

    expect(order?.merchantId).toBe(7);
    expect(order?.status).toBe("accepted");
  });

  it("should create transaction", async () => {
    const transactionId = await db.createTransaction(
      1,
      1,
      2,
      "100.00",
      "payment",
      "订单支付"
    );

    expect(transactionId).toBeDefined();
    expect(typeof transactionId).toBe("number");
  });

  it("should create recharge", async () => {
    const rechargeId = await db.createRecharge(1, "100.00", "manual");

    expect(rechargeId).toBeDefined();
    expect(typeof rechargeId).toBe("number");
  });
});
