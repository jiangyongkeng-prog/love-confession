import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    register: publicProcedure
      .input(z.object({
        username: z.string().min(3).max(64),
        password: z.string().min(6),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ input }) => {
        const existing = await db.getUserByUsername(input.username);
        if (existing) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "用户名已存在",
          });
        }

        const hashedPassword = await bcrypt.hash(input.password, 10);
        const userId = await db.createUser(input.username, hashedPassword, input.email);

        return { id: userId, username: input.username };
      }),

    login: publicProcedure
      .input(z.object({
        username: z.string(),
        password: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByUsername(input.username);
        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "用户名或密码错误",
          });
        }

        if (!user.password) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "用户名或密码错误",
          });
        }

        const passwordMatch = await bcrypt.compare(input.password, user.password);
        if (!passwordMatch) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "用户名或密码错误",
          });
        }

        const cookieOptions = getSessionCookieOptions(ctx.req);
        const sessionValue = `${user.id}:${user.username}`;
        ctx.res.cookie(COOKIE_NAME, sessionValue, cookieOptions);

        return { id: user.id, username: user.username, role: user.role };
      }),
  }),

  orders: router({
    // 创建任务 - type 支持任意字符串（自定义类型）
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        type: z.string().min(1), // 支持任意字符串，包括自定义类型
        price: z.string(),
        dueDate: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const orderId = await db.createOrder(
          ctx.user.id,
          input.title,
          input.description || "",
          input.type,
          input.price,
          input.dueDate
        );

        return { id: orderId };
      }),

    // 获取客户自己的所有任务
    getMyOrders: protectedProcedure.query(async ({ ctx }) => {
      return db.getOrdersByCustomer(ctx.user.id);
    }),

    // 获取商家已接单的任务
    getAcceptedOrders: protectedProcedure.query(async ({ ctx }) => {
      return db.getOrdersByMerchant(ctx.user.id);
    }),

    // 获取所有待接单的任务（商家查看）
    getPending: publicProcedure.query(async () => {
      return db.getPendingOrders();
    }),

    // 获取所有不重复的任务类型（用于动态加载下拉选项）
    getDistinctTypes: publicProcedure.query(async () => {
      return db.getDistinctOrderTypes();
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getOrderById(input.id);
      }),

    // 商家接单
    accept: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });
        }

        if (order.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "订单状态不允许接单" });
        }

        await db.acceptOrder(input.orderId, ctx.user.id);
        return { success: true };
      }),

    // 商家完成任务 - 自动从客户账户扣款
    complete: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });
        }

        if (order.merchantId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "无权限完成此订单" });
        }

        if (order.status !== "accepted") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "订单状态不允许完成（需要先接单）" });
        }

        // 更新订单状态
        await db.updateOrderStatus(input.orderId, "completed");
        
        // 从客户账户中扣除报价
        const customer = await db.getUserById(order.customerId);
        if (customer) {
          const currentBalance = parseFloat(customer.balance.toString());
          const orderPrice = parseFloat(order.price.toString());
          const newBalance = Math.max(0, currentBalance - orderPrice).toFixed(2);
          await db.updateUserBalance(order.customerId, newBalance);
        }
        
        return { success: true };
      }),

    // 支付订单
    pay: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });
        }

        if (order.customerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "无权限支付此订单" });
        }

        if (order.status !== "completed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "订单未完成，无法支付" });
        }

        const customer = await db.getUserById(order.customerId);
        const merchant = await db.getUserById(order.merchantId!);

        if (!customer || !merchant) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "用户信息错误" });
        }

        if (parseFloat(customer.balance) < parseFloat(order.price)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "余额不足" });
        }

        const newCustomerBalance = (parseFloat(customer.balance) - parseFloat(order.price)).toFixed(2);
        const newMerchantBalance = (parseFloat(merchant.balance) + parseFloat(order.price)).toFixed(2);

        await db.updateUserBalance(order.customerId, newCustomerBalance);
        await db.updateUserBalance(order.merchantId!, newMerchantBalance);

        await db.createTransaction(
          input.orderId,
          order.customerId,
          order.merchantId!,
          order.price,
          "payment",
          `订单 #${input.orderId} 支付`
        );

        await db.updateOrderStatus(input.orderId, "paid");

        return { success: true };
      }),

    // 取消订单
    cancel: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });
        }

        if (order.customerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "无权限取消此订单" });
        }

        if (order.status === "paid" || order.status === "cancelled") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "订单状态不允许取消" });
        }

        await db.updateOrderStatus(input.orderId, "cancelled");
        return { success: true };
      }),

    // 删除单个订单（仅限 pending 状态）
    delete: protectedProcedure
      .input(z.object({ orderId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const order = await db.getOrderById(input.orderId);
        if (!order) {
          throw new TRPCError({ code: "NOT_FOUND", message: "订单不存在" });
        }

        if (order.customerId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "无权限删除此订单" });
        }

        if (order.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "只能删除待接单的订单" });
        }

        await db.deleteOrder(input.orderId);
        return { success: true };
      }),

    // 客户一键清空所有任务（不限状态，真实删除）
    deleteAllMyOrders: protectedProcedure
      .mutation(async ({ ctx }) => {
        await db.deleteAllOrdersByCustomer(ctx.user.id);
        return { success: true };
      }),

    // 商家一键清空已接单/已完成订单
    clearAcceptedOrders: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "仅商家可操作" });
        }
        await db.deleteAcceptedOrdersByMerchant(ctx.user.id);
        return { success: true };
      }),

    // 商家批量批准所有待接单
    approveAllPending: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "仅商家可操作" });
        }
        const pendingOrders = await db.getPendingOrders();
        for (const order of pendingOrders) {
          await db.acceptOrder(order.id, ctx.user.id);
        }
        return { success: true, count: pendingOrders.length };
      }),
  }),

  account: router({
    getProfile: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserById(ctx.user.id);
    }),

    // 客户申请充值
    recharge: protectedProcedure
      .input(z.object({ amount: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const rechargeId = await db.createRecharge(ctx.user.id, input.amount, "alipay");
        return { success: true, rechargeId, status: "pending", message: "请扫描支付宝二维码支付，支付后请告知管理员确认" };
      }),

    getPendingRecharges: protectedProcedure.query(async ({ ctx }) => {
      return db.getPendingRechargesByUser(ctx.user.id);
    }),

    // 获取支付宝收款码（真实 CDN URL）
    getAlipayQrCode: publicProcedure.query(async () => {
      return {
        qrCodeUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663411531548/geonz6r78k6o6GjBy94wRM/alipay-qrcode_4e4faf4c.jpg",
        instructions: "请扫描二维码使用支付宝支付，支付后请告知管理员确认"
      };
    }),

    getTransactions: protectedProcedure.query(async ({ ctx }) => {
      return db.getTransactionsByUser(ctx.user.id);
    }),
  }),

  admin: router({
    // 获取所有待审核的充值请求
    getPendingRecharges: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可访问" });
      }
      return db.getPendingRecharges();
    }),

    // 批准充值请求（真实增加客户余额）
    approveRecharge: protectedProcedure
      .input(z.object({ rechargeId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可操作" });
        }
        await db.approveRecharge(input.rechargeId, ctx.user.id);
        return { success: true };
      }),

    // 拒绝充值请求
    rejectRecharge: protectedProcedure
      .input(z.object({ rechargeId: z.number(), reason: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可操作" });
        }
        await db.rejectRecharge(input.rechargeId, input.reason || "");
        return { success: true };
      }),

    // 清空已处理的充值记录
    clearProcessedRecharges: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可操作" });
        }
        return db.clearProcessedRecharges();
      }),

    // 批量批准所有待审核充值请求
    bulkApproveRecharges: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员可操作" });
        }
        const pendingList = await db.getPendingRecharges();
        let successCount = 0;
        for (const recharge of pendingList) {
          try {
            await db.approveRecharge(recharge.id, ctx.user.id);
            successCount++;
          } catch (e) {
            // 跳过单条失败，继续处理其他
          }
        }
        return { success: true, count: successCount };
      }),
  }),
});

export type AppRouter = typeof appRouter;
