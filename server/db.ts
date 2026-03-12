import 'dotenv/config'
import { eq, and, or, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, orders, transactions, recharges, Order, Transaction, Recharge } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ===== User queries =====
export async function createUser(username: string, hashedPassword: string, email?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const values: any = { username, password: hashedPassword };
  if (email) {
    values.email = email;
  }

  const result = await db
    .insert(users)
    .values(values)
    .$returningId();

  return result[0].id;
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return result[0];
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result[0];
}

export async function updateUserBalance(userId: number, amount: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .update(users)
    .set({ balance: amount })
    .where(eq(users.id, userId));
}

// ===== Order queries =====
// type 字段现在支持任意字符串（包括自定义类型）
export async function createOrder(customerId: number, title: string, description: string, type: string, price: string, dueDate?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .insert(orders)
    .values({ customerId, title, description, type, price, dueDate })
    .$returningId();

  return result[0].id;
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  return result[0];
}

export async function getOrdersByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(orders)
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orders.createdAt));
}

export async function getOrdersByMerchant(merchantId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(orders)
    .where(eq(orders.merchantId, merchantId));
}

export async function getPendingOrders() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(orders)
    .where(eq(orders.status, "pending"));
}

export async function updateOrderStatus(orderId: number, status: "pending" | "accepted" | "completed" | "cancelled" | "paid") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: any = { status };
  if (status === "completed") {
    updateData.completedAt = new Date();
  } else if (status === "paid") {
    updateData.paidAt = new Date();
  }

  return db
    .update(orders)
    .set(updateData)
    .where(eq(orders.id, orderId));
}

export async function acceptOrder(orderId: number, merchantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(orders)
    .set({ merchantId, status: "accepted" })
    .where(eq(orders.id, orderId))
    .execute();
}

// 删除单个订单（仅限 pending 状态）
export async function deleteOrder(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");

  // Only allow deleting pending orders
  if (order.status !== "pending") {
    throw new Error("只能删除待接单的订单");
  }

  return db
    .delete(orders)
    .where(eq(orders.id, orderId));
}

// 强制删除订单（不限状态，用于一键清空）
export async function deleteOrderForce(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .delete(orders)
    .where(eq(orders.id, orderId));
}

// 删除客户的所有订单（一键清空，不限状态）
export async function deleteAllOrdersByCustomer(customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .delete(orders)
    .where(eq(orders.customerId, customerId));
}

// 删除商家的所有已接单/已完成订单（商家一键清空）
export async function deleteAcceptedOrdersByMerchant(merchantId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .delete(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        or(
          eq(orders.status, "accepted"),
          eq(orders.status, "completed"),
          eq(orders.status, "paid")
        )
      )
    );
}

// 获取所有不重复的任务类型（用于动态加载下拉选项，纯数据库数据，无硬编码）
export async function getDistinctOrderTypes() {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .selectDistinct({ type: orders.type })
    .from(orders);

  return result.map((r: any) => r.type).filter(Boolean) as string[];
}

// ===== Transaction queries =====
export async function createTransaction(orderId: number, fromUserId: number, toUserId: number, amount: string, type: "payment" | "refund" | "recharge", description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .insert(transactions)
    .values({ orderId, fromUserId, toUserId, amount, type, description })
    .$returningId();

  return result[0].id;
}

export async function getTransactionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(transactions)
    .where(eq(transactions.fromUserId, userId));
}

export async function completeTransaction(transactionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .update(transactions)
    .set({ status: "completed" })
    .where(eq(transactions.id, transactionId));
}

// ===== Recharge queries =====
export async function createRecharge(userId: number, amount: string, method: string = "manual", screenshotUrl?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db
    .insert(recharges)
    .values({ userId, amount, method, screenshotUrl, status: "pending" })
    .$returningId();

  return result[0].id;
}

export async function approveRecharge(rechargeId: number, approvedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const recharge = await db
    .select()
    .from(recharges)
    .where(eq(recharges.id, rechargeId))
    .limit(1);

  if (!recharge[0]) throw new Error("Recharge not found");

  // Update recharge status
  await db
    .update(recharges)
    .set({ status: "approved", approvedBy, approvedAt: new Date() })
    .where(eq(recharges.id, rechargeId));

  // Update user balance
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, recharge[0].userId))
    .limit(1);

  if (user[0]) {
    const newBalance = (parseFloat(user[0].balance.toString()) + parseFloat(recharge[0].amount.toString())).toFixed(2);
    await db
      .update(users)
      .set({ balance: newBalance })
      .where(eq(users.id, recharge[0].userId));
  }

  return true;
}

export async function rejectRecharge(rechargeId: number, rejectionReason: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .update(recharges)
    .set({ status: "rejected", rejectionReason })
    .where(eq(recharges.id, rechargeId));
}

export async function completeRecharge(rechargeId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .update(recharges)
    .set({ status: "completed" })
    .where(eq(recharges.id, rechargeId));
}

export async function getRechargesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(recharges)
    .where(eq(recharges.userId, userId));
}

export async function getPendingRechargesByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(recharges)
    .where(and(eq(recharges.userId, userId), eq(recharges.status, "pending")));
}

export async function getPendingRecharges() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(recharges)
    .where(eq(recharges.status, "pending"));
}

export async function clearProcessedRecharges() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .delete(recharges)
    .where(
      or(
        eq(recharges.status, "approved"),
        eq(recharges.status, "rejected")
      )
    );

  return { success: true };
}
