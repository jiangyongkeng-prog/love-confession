import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Particles from "@/components/Particles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Page = "login" | "register" | "customer-dashboard" | "merchant-dashboard" | "create-order" | "my-orders" | "accepted-orders" | "account" | "recharge-approval";

export default function Home() {
  // ========== 所有 State ==========
  const [currentPage, setCurrentPage] = useState<Page>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentUser, setCurrentUser] = useState<{ id: number; username: string | null; role: "user" | "admin" } | null>(null);
  const [userRole, setUserRole] = useState<"customer" | "merchant" | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orderTitle, setOrderTitle] = useState("");
  const [orderDesc, setOrderDesc] = useState("");
  const [orderPrice, setOrderPrice] = useState("");
  const [orderType, setOrderType] = useState<string>("");
  const [customTypeInput, setCustomTypeInput] = useState("");
  const [showCustomTypeInput, setShowCustomTypeInput] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("");

  // ========== 所有 Queries（顶层无条件调用）==========
  const { data: profile } = trpc.account.getProfile.useQuery(undefined, {
    enabled: !!currentUser,
  });
  const { data: myOrders = [] } = trpc.orders.getMyOrders.useQuery(undefined, {
    enabled: !!currentUser && userRole === "customer",
  });
  const { data: acceptedOrders = [] } = trpc.orders.getAcceptedOrders.useQuery(undefined, {
    enabled: !!currentUser && userRole === "merchant",
  });
  const { data: pendingOrders = [] } = trpc.orders.getPending.useQuery(undefined, {
    enabled: !!currentUser && userRole === "merchant",
  });
  const { data: pendingRecharges = [] } = trpc.admin.getPendingRecharges.useQuery(undefined, {
    enabled: !!currentUser && userRole === "merchant",
  });
  // 动态加载任务类型（从数据库获取所有不重复的类型）
  const { data: distinctTypes = [] } = trpc.orders.getDistinctTypes.useQuery(undefined, {
    enabled: !!currentUser && userRole === "customer",
  });
  // 纯动态加载任务类型（仅来自数据库，无硬编码）
  const allOrderTypes: string[] = Array.isArray(distinctTypes) 
    ? distinctTypes.map((t: any) => typeof t === 'string' ? t : t.type).filter(Boolean)
    : [];

  // ========== 所有 Mutations（顶层无条件调用）==========
  const utils = trpc.useUtils();
  const registerMutation = trpc.auth.register.useMutation();
  const loginMutation = trpc.auth.login.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: () => {
      toast.success("任务已创建");
      setCurrentPage("my-orders");
      setOrderTitle("");
      setOrderDesc("");
      setOrderPrice("");
      setOrderType("task");
    },
    onError: (error) => {
      toast.error(error.message || "创建失败");
    },
  });
  const deleteAllPendingMutation = trpc.orders.deleteAllMyOrders.useMutation({
    onSuccess: () => {
      toast.success("所有任务已删除");
      utils.orders.getMyOrders.invalidate();
      setShowDeleteConfirm(false);
    },
    onError: (error) => {
      toast.error(error.message || "删除失败");
    },
  });
  const rechargeMutation = trpc.account.recharge.useMutation({
    onSuccess: () => {
      toast.success("充值申请已提交，等待商家审核");
      setRechargeAmount("");
    },
    onError: (error: any) => {
      toast.error(error.message || "申请失败");
    },
  });
  const acceptOrderMutation = trpc.orders.accept.useMutation({
    onSuccess: () => {
      toast.success("已接单");
      utils.orders.getPending.invalidate();
      utils.orders.getAcceptedOrders.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "接单失败");
    },
  });
  const completeOrderMutation = trpc.orders.complete.useMutation({
    onSuccess: () => {
      toast.success("任务已完成，客户已扣款");
      utils.orders.getAcceptedOrders.invalidate();
      utils.account.getProfile.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "完成失败");
    },
  });
  const approveRechargeMutation = trpc.admin.approveRecharge.useMutation({
    onSuccess: () => {
      toast.success("充值已批准，客户账户已更新");
      utils.admin.getPendingRecharges.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "批准失败");
    },
  });
  const rejectRechargeMutation = trpc.admin.rejectRecharge.useMutation({
    onSuccess: () => {
      toast.success("充值已拒绝");
      utils.admin.getPendingRecharges.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "拒绝失败");
    },
  });

  const clearAcceptedOrdersMutation = trpc.orders.clearAcceptedOrders.useMutation({
    onSuccess: () => {
      toast.success("已接单已清空");
      utils.orders.getAcceptedOrders.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "清空失败");
    },
  });

  const bulkApproveRechargesMutation = trpc.admin.bulkApproveRecharges.useMutation({
    onSuccess: (data) => {
      toast.success(`批量批准成功！共批准 ${data.count} 条充值请求`);
      utils.admin.getPendingRecharges.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "批量批准失败");
    },
  });

  const clearProcessedRechargesMutation = trpc.admin.clearProcessedRecharges.useMutation({
    onSuccess: () => {
      toast.success("已处理的充值已清空");
      utils.admin.getPendingRecharges.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "清空失败");
    },
  });

  // ========== useEffect：从 localStorage 恢复用户 ==========
  useEffect(() => {
    const stored = localStorage.getItem("currentUser");
    if (stored) {
      try {
        const user = JSON.parse(stored);
        setCurrentUser(user);
        // 根据 role 自动设置角色
        if (user.role === "admin") {
          setUserRole("merchant");
          setCurrentPage("merchant-dashboard");
        } else {
          setUserRole("customer");
          setCurrentPage("customer-dashboard");
        }
      } catch (e) {
        localStorage.removeItem("currentUser");
      }
    }
  }, []);

  // ========== 事件处理函数 ==========
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await loginMutation.mutateAsync({ username, password });
      const user = { id: result.id, username: result.username, role: result.role };
      setCurrentUser(user);
      localStorage.setItem("currentUser", JSON.stringify(user));

      // 根据 role 自动路由
      if (result.role === "admin") {
        setUserRole("merchant");
        setCurrentPage("merchant-dashboard");
      } else {
        setUserRole("customer");
        setCurrentPage("customer-dashboard");
      }
      toast.success("登录成功");
    } catch (error: any) {
      toast.error(error.message || "登录失败");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registerMutation.mutateAsync({ username, password });
      toast.success("注册成功，请登录");
      setCurrentPage("login");
      setUsername("");
      setPassword("");
    } catch (error: any) {
      toast.error(error.message || "注册失败");
    }
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      setCurrentUser(null);
      setUserRole(null);
      localStorage.removeItem("currentUser");
      setCurrentPage("login");
      setUsername("");
      setPassword("");
      toast.success("已退出登录");
    } catch (error: any) {
      toast.error(error.message || "退出失败");
    }
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    createOrderMutation.mutate({
      title: orderTitle,
      description: orderDesc,
      type: orderType,
      price: orderPrice,
    });
  };

  const handleRecharge = (e: React.FormEvent) => {
    e.preventDefault();
    rechargeMutation.mutate({ amount: rechargeAmount });
  };

  const handleDeleteAll = () => {
    deleteAllPendingMutation.mutate();
    setShowDeleteConfirm(false);
  };

  const handleAcceptOrder = async (orderId: number) => {
    try {
      await acceptOrderMutation.mutateAsync({ orderId });
      toast.success("已接单！");
      await utils.orders.getPending.refetch();
      await utils.orders.getAcceptedOrders.refetch();
    } catch (error: any) {
      toast.error(error.message || "接单失败");
    }
  };

  const handleCompleteOrder = async (orderId: number) => {
    try {
      await completeOrderMutation.mutateAsync({ orderId });
      toast.success("订单已完成！");
      await utils.orders.getAcceptedOrders.refetch();
      await utils.orders.getMyOrders.refetch();
    } catch (error: any) {
      toast.error(error.message || "完成订单失败");
    }
  };

  // ==================== 登录/注册页面 ====================
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-4 relative overflow-hidden">
        <Particles />
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative z-10">
          <h1 className="text-4xl font-bold text-center mb-8 text-gray-900">
            🎖️ WMS指挥部
          </h1>

          {currentPage === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">登录账号</h2>
              <input
                type="text"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button type="submit" className="w-full py-3 text-lg">
                登录
              </Button>
              <p className="text-center text-gray-700 font-medium">
                没有账号？
                <button
                  type="button"
                  onClick={() => setCurrentPage("register")}
                  className="text-blue-600 hover:text-blue-700 hover:underline ml-2 font-semibold"
                >
                  点击注册
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">创建账号</h2>
              <input
                type="text"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button type="submit" className="w-full py-3 text-lg">
                注册
              </Button>
              <p className="text-center text-gray-700 font-medium">
                已有账号？
                <button
                  type="button"
                  onClick={() => setCurrentPage("login")}
                  className="text-blue-600 hover:text-blue-700 hover:underline ml-2 font-semibold"
                >
                  点击登录
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ==================== 客户主界面 - Dashboard ====================
  if (userRole === "customer" && currentPage === "customer-dashboard") {
    const balance = profile?.balance || "0.00";
    const pendingCount = myOrders.filter(o => o.status !== "completed" && o.status !== "paid").length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">💼 我的指挥部</h1>
            <Button variant="outline" onClick={handleLogout} className="text-red-600 hover:text-red-700">
              退出登录
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* 数据看板 */}
          <div className="grid grid-cols-2 gap-6 mb-12">
            <div className="bg-white rounded-xl shadow-md p-8 border-l-4 border-blue-500">
              <p className="text-gray-600 text-sm font-medium mb-2">当前账户余额</p>
              <p className="text-4xl font-bold text-blue-600">¥ {balance}</p>
            </div>
            <div className="bg-white rounded-xl shadow-md p-8 border-l-4 border-orange-500">
              <p className="text-gray-600 text-sm font-medium mb-2">进行中的任务</p>
              <p className="text-4xl font-bold text-orange-600">{pendingCount} 个</p>
            </div>
          </div>

          {/* 核心功能区 - Grid 布局 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* 充值中心 */}
            <button
              onClick={() => setCurrentPage("recharge-approval")}
              className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-center hover:scale-105 transform"
            >
              <div className="text-6xl mb-4">💸</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">充值中心</h3>
              <p className="text-gray-600 text-sm">申请充值，增加账户余额</p>
              <div className="mt-6 text-blue-600 font-semibold group-hover:text-blue-700">点击进入 →</div>
            </button>

            {/* 下达任务 */}
            <button
              onClick={() => setCurrentPage("create-order")}
              className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-center hover:scale-105 transform"
            >
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">下达任务</h3>
              <p className="text-gray-600 text-sm">创建新的任务，等待商家接单</p>
              <div className="mt-6 text-blue-600 font-semibold group-hover:text-blue-700">点击进入 →</div>
            </button>

            {/* 我的任务 */}
            <button
              onClick={() => setCurrentPage("my-orders")}
              className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-center hover:scale-105 transform"
            >
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">我的任务</h3>
              <p className="text-gray-600 text-sm">查看和管理所有任务记录</p>
              <div className="mt-6 text-blue-600 font-semibold group-hover:text-blue-700">点击进入 →</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 我的任务页面 ====================
  if (userRole === "customer" && currentPage === "my-orders") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <button
              onClick={() => setCurrentPage("customer-dashboard")}
              className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2"
            >
              ← 返回主界面
            </button>
            <h1 className="text-2xl font-bold text-gray-900">📋 我的任务</h1>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg"
            >
              一键清空
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {myOrders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <p className="text-gray-600 text-lg">暂无任务</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {myOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">{order.title}</h3>
                      <p className="text-gray-600 text-sm mt-2">{order.description}</p>
                      <div className="flex gap-4 mt-4 text-sm">
                        <span className="text-gray-700">类型: {order.type}</span>
                        <span className="text-gray-700">报价: ¥{order.price}</span>
                        <span className="text-gray-700">状态: {order.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 删除确认对话框 */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogTitle>确认删除所有任务？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将删除所有待接单的任务，已接单的任务不会被删除。此操作无法撤销。
            </AlertDialogDescription>
            <div className="flex gap-4">
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAll}>
                确认删除
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ==================== 下达任务页面 ====================
  if (userRole === "customer" && currentPage === "create-order") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="bg-white shadow-sm border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <button
              onClick={() => setCurrentPage("customer-dashboard")}
              className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2 mb-4 transition-colors"
            >
              ← 返回主界面
            </button>
            <h1 className="text-2xl font-bold text-gray-900">📝 下达任务</h1>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-6 py-8">
          <form onSubmit={handleCreateOrder} className="bg-white rounded-2xl shadow-xl p-8 space-y-6 border border-gray-100">
            {/* 任务标题 */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm tracking-wide">任务标题 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={orderTitle}
                onChange={(e) => setOrderTitle(e.target.value)}
                placeholder="输入任务标题，例如：帮我打扫卫生间"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent shadow-sm transition-all text-gray-900 placeholder-gray-400"
                required
              />
            </div>
            {/* 任务描述 */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm tracking-wide">任务描述</label>
              <textarea
                value={orderDesc}
                onChange={(e) => setOrderDesc(e.target.value)}
                placeholder="详细描述任务要求，越详细越好…"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent shadow-sm transition-all h-28 resize-none text-gray-900 placeholder-gray-400"
              />
            </div>
            {/* 任务类型（Creatable Select） */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm tracking-wide">任务类型 <span className="text-red-500">*</span></label>
              <div className="space-y-3">
                {/* 已有类型快捷选择（仅显示数据库中实际存在的类型） */}
                <div className="flex flex-wrap gap-2">
                  {allOrderTypes.length === 0 && !showCustomTypeInput && (
                    <p className="text-xs text-gray-400 italic py-1">暂无历史类型，请使用自定义输入→</p>
                  )}
                  {allOrderTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => { setOrderType(type); setShowCustomTypeInput(false); }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                        orderType === type && !showCustomTypeInput
                          ? "bg-blue-600 text-white shadow-md border-blue-600"
                          : "bg-white text-gray-700 border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                  {/* 自定义类型按鈕 */}
                  <button
                    type="button"
                    onClick={() => { setShowCustomTypeInput(true); setCustomTypeInput(""); }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                      showCustomTypeInput
                        ? "bg-purple-600 text-white shadow-md border-purple-600"
                        : "bg-white text-gray-600 border-dashed border-gray-300 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300"
                    }`}
                  >
                    + 自定义类型
                  </button>
                </div>
                {/* 自定义类型输入框 */}
                {showCustomTypeInput && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customTypeInput}
                      onChange={(e) => setCustomTypeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (customTypeInput.trim()) {
                            setOrderType(customTypeInput.trim());
                            setShowCustomTypeInput(false);
                          }
                        } else if (e.key === 'Escape') {
                          setShowCustomTypeInput(false);
                        }
                      }}
                      placeholder="输入自定义类型，例如：陨打游戏、特殊奖励…"
                      className="flex-1 px-4 py-2.5 border border-purple-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent shadow-sm text-gray-900 placeholder-gray-400"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customTypeInput.trim()) {
                          setOrderType(customTypeInput.trim());
                          setShowCustomTypeInput(false);
                        }
                      }}
                      className="px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium text-sm transition-colors shadow-sm"
                    >
                      确认
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomTypeInput(false)}
                      className="px-3 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 font-medium text-sm transition-colors"
                    >
                      取消
                    </button>
                  </div>
                )}
                {/* 显示当前选择的类型 */}
                {!showCustomTypeInput && orderType && (
                  <p className="text-xs text-gray-500">当前选择：<span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{orderType}</span></p>
                )}
              </div>
            </div>
            {/* 报价 */}
            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm tracking-wide">报价（¥） <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">¥</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent shadow-sm transition-all text-gray-900 placeholder-gray-400"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full py-3.5 text-base font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all"
              disabled={createOrderMutation.isPending}
            >
              {createOrderMutation.isPending ? "创建中..." : "🚀 创建任务"}
            </Button>
          </form>
        </div>
      </div>
    );
  }
  // ==================== 充值中心页面 ====================
  if (userRole === "customer" && currentPage === "recharge-approval") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <button
              onClick={() => setCurrentPage("customer-dashboard")}
              className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2 mb-4"
            >
              ← 返回主界面
            </button>
            <h1 className="text-2xl font-bold text-gray-900">💸 充值中心</h1>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
          {/* 支付宝收款码 */}
          <div className="bg-white rounded-xl shadow-md p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">支付宝收款</h2>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-8 flex flex-col items-center">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663411531548/geonz6r78k6o6GjBy94wRM/pasted_file_idScCb_df3cfd922f408ee98e303139c2b4d00b_e53b7487.jpg"
                alt="支付宝收款码"
                className="w-48 h-48 rounded-lg shadow-lg"
              />
              <p className="text-gray-700 text-sm mt-4 text-center">扫描二维码进行支付</p>
            </div>
          </div>

          {/* 充值表单 */}
          <form onSubmit={handleRecharge} className="bg-white rounded-xl shadow-md p-8 space-y-6">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">充值金额（¥）</label>
              <input
                type="number"
                step="0.01"
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(e.target.value)}
                placeholder="输入充值金额"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm">
                💡 提示：提交充值申请后，商家会进行审核。审核通过后，金额会自动加入你的账户。
              </p>
            </div>

            <Button type="submit" className="w-full py-3 text-lg">
              生成充值请求
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ==================== 商家仪表板 ====================
  if (userRole === "merchant" && currentPage === "merchant-dashboard") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">🏪 商家仪表板</h1>
            <Button variant="outline" onClick={handleLogout} className="text-red-600 hover:text-red-700">
              退出登录
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <button
              onClick={() => setCurrentPage("account")}
              className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-center hover:scale-105 transform"
            >
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">待接单</h3>
              <p className="text-gray-600 text-sm">查看所有待接单任务</p>
            </button>

            <button
              onClick={() => setCurrentPage("accepted-orders")}
              className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-center hover:scale-105 transform"
            >
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">已接单</h3>
              <p className="text-gray-600 text-sm">查看已接单的任务</p>
            </button>

            <button
              onClick={() => setCurrentPage("recharge-approval")}
              className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-center hover:scale-105 transform"
            >
              <div className="text-6xl mb-4">💰</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">充值审核</h3>
              <p className="text-gray-600 text-sm">审核客户充值请求</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 待接单页面 ====================
  if (userRole === "merchant" && currentPage === "account") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <button
              onClick={() => setCurrentPage("merchant-dashboard")}
              className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2 mb-4"
            >
              ← 返回仪表板
            </button>
            <h1 className="text-2xl font-bold text-gray-900">📊 待接单</h1>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {pendingOrders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <p className="text-gray-600 text-lg">暂无待接单任务</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">{order.title}</h3>
                      <p className="text-gray-600 text-sm mt-2">{order.description}</p>
                      <div className="flex gap-4 mt-4 text-sm">
                        <span className="text-gray-700">类型: {order.type}</span>
                        <span className="text-gray-700">报价: ¥{order.price}</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleAcceptOrder(order.id)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      接单
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== 已接单页面 ====================
  if (userRole === "merchant" && currentPage === "accepted-orders") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <button
              onClick={() => setCurrentPage("merchant-dashboard")}
              className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2 mb-4"
            >
              ← 返回仪表板
            </button>
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">✅ 已接单</h1>
              <Button
                onClick={() => {
                  if (confirm("确定要清空所有已接单记录吗？此操作不可撤销。")) {
                    clearAcceptedOrdersMutation.mutate();
                  }
                }}
                variant="destructive"
                disabled={clearAcceptedOrdersMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {clearAcceptedOrdersMutation.isPending ? "清空中..." : "一键清空"}
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {acceptedOrders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <p className="text-gray-600 text-lg">暂无已接单任务</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {acceptedOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">{order.title}</h3>
                      <p className="text-gray-600 text-sm mt-2">{order.description}</p>
                      <div className="flex gap-4 mt-4 text-sm">
                        <span className="text-gray-700">类型: {order.type}</span>
                        <span className="text-gray-700">报价: ¥{order.price}</span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleCompleteOrder(order.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      完成
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== 商家充值审核页面 ====================
  if (userRole === "merchant" && currentPage === "recharge-approval") {
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <button
              onClick={() => setCurrentPage("merchant-dashboard")}
              className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-2 mb-4"
            >
              ← 返回仪表板
            </button>
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">💰 充值审核</h1>
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    if (confirm(`确定要批量批准所有 ${pendingRecharges?.length || 0} 条待审核充值请求吗？此操作将直接把这些金额全部加到对应客户的余额中。`)) {
                      bulkApproveRechargesMutation.mutate();
                    }
                  }}
                  disabled={bulkApproveRechargesMutation.isPending || !pendingRecharges?.length}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2 shadow-lg"
                >
                  {bulkApproveRechargesMutation.isPending ? "批量批准中..." : `✅ 批量批准 (${pendingRecharges?.length || 0})`}
                </Button>
                <Button
                  onClick={() => {
                    if (confirm("确定要清空所有已处理的充值记录吗？此操作不可撤销。")) {
                      clearProcessedRechargesMutation.mutate();
                    }
                  }}
                  variant="destructive"
                  disabled={clearProcessedRechargesMutation.isPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {clearProcessedRechargesMutation.isPending ? "清空中..." : "清空已处理"}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-8">
          {!pendingRecharges || pendingRecharges.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <p className="text-gray-600 text-lg">暂无待审核充值请求</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingRecharges.map((recharge: any) => (
                <div key={recharge.id} className="bg-white rounded-xl shadow-md p-6 border-l-4 border-yellow-500">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">充值请求</h3>
                      <p className="text-gray-600 text-sm mt-2">用户 ID: {recharge.userId}</p>
                      <div className="flex gap-4 mt-4 text-sm">
                        <span className="text-gray-700">金额: ¥{recharge.amount}</span>
                        <span className="text-gray-700">方式: {recharge.method}</span>
                        <span className="text-gray-700">状态: {recharge.status}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => approveRechargeMutation.mutate({ rechargeId: recharge.id })}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        disabled={approveRechargeMutation.isPending}
                      >
                        {approveRechargeMutation.isPending ? "处理中..." : "批准"}
                      </Button>
                      <Button
                        onClick={() => rejectRechargeMutation.mutate({ rechargeId: recharge.id })}
                        variant="destructive"
                        disabled={rejectRechargeMutation.isPending}
                      >
                        {rejectRechargeMutation.isPending ? "处理中..." : "拒绝"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
