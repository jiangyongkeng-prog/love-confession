import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean } from "drizzle-orm/mysql-core";

/**
 * Users table - stores user accounts with both OAuth and local authentication
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(), // OAuth identifier
  username: varchar("username", { length: 64 }).unique(), // local auth username
  password: text("password"), // hashed password (null for OAuth users)
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }), // 'oauth' or 'local'
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0.00").notNull(), // account balance
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Orders table - stores orders/requests between users
 * Customer creates order, Merchant accepts and completes
 */
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(), // who created the order
  merchantId: int("merchantId"), // who accepted the order (null if not accepted yet)
  title: varchar("title", { length: 200 }).notNull(), // order title
  description: text("description"), // detailed description
  type: varchar("type", { length: 100 }).notNull(), // 点菜/家务/约会/自定义类型
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // order price
  status: mysqlEnum("status", ["pending", "accepted", "completed", "cancelled", "paid"]).default("pending").notNull(),
  // pending: 待接单
  // accepted: 已接单
  // completed: 已完成（待支付）
  // paid: 已支付
  // cancelled: 已取消
  dueDate: timestamp("dueDate"), // deadline for the order
  completedAt: timestamp("completedAt"), // when merchant marked as completed
  paidAt: timestamp("paidAt"), // when customer paid
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

/**
 * Transactions table - stores payment records
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(), // related order
  fromUserId: int("fromUserId").notNull(), // payer (customer)
  toUserId: int("toUserId").notNull(), // payee (merchant)
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: mysqlEnum("type", ["payment", "refund", "recharge"]).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

/**
 * Recharge records - tracks balance recharges
 */
export const recharges = mysqlTable("recharges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  method: varchar("method", { length: 50 }).default("manual"),
  screenshotUrl: text("screenshotUrl"),
  status: mysqlEnum("status", ["pending", "completed", "approved", "rejected", "failed"]).default("pending").notNull(),
  approvedBy: int("approvedBy"),
  approvedAt: timestamp("approvedAt"),
  rejectionReason: text("rejectionReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Recharge = typeof recharges.$inferSelect;
export type InsertRecharge = typeof recharges.$inferInsert;

/**
 * Partnerships table - links customers and merchants (for easier querying)
 * In a real app, this might be a many-to-many relationship
 */
export const partnerships = mysqlTable("partnerships", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  merchantId: int("merchantId").notNull(),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Partnership = typeof partnerships.$inferSelect;
export type InsertPartnership = typeof partnerships.$inferInsert;
