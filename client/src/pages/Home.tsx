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

  // AI 魔法相关 State
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

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
  const { data: distinctTypes = [] } = trpc.orders.getDistinctTypes.useQuery(undefined, {
    enabled: !!currentUser && userRole === "customer",
  });

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
      toast.success("任务发布成功！");
      setCurrentPage("my-orders");
      setOrderTitle("");
      setOrderDesc("");
      setOrderPrice("");
      setOrderType("");
    },
    onError: (error) => {
      toast.error(error.message || "发布失败");
    },
  });
  const deleteAllPendingMutation = trpc.orders.deleteAllMyOrders.useMutation({
    onSuccess: () => {
      toast.success("记录已清空");
      utils.orders.getMyOrders.invalidate();
      setShowDeleteConfirm(false);
    },
    onError: (error) => {
      toast.error(error.message || "清空失败");
    },
  });
  const rechargeMutation = trpc.account.recharge.useMutation({
    onSuccess: () => {
      toast.success("充值申请已提交，等待审核");
      setRechargeAmount("");
    },
    onError: (error: any) => {
      toast.error(error.message || "申请失败");
    },
  });
  const acceptOrderMutation = trpc.orders.accept.useMutation({
    onSuccess: () => {
      toast.success("接单成功！");
      utils.orders.getPending.invalidate();
      utils.orders.getAcceptedOrders.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "接单失败");
    },
  });
  const completeOrderMutation = trpc.orders.complete.useMutation({
    onSuccess: () => {
      toast.success("任务已完成！");
      utils.orders.getAcceptedOrders.invalidate();
      utils.account.getProfile.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "操作失败");
    },
  });
  const approveRechargeMutation = trpc.admin.approveRecharge.useMutation({
    onSuccess: () => {
      toast.success("充值已批准，余额已更新");
      utils.admin.getPendingRecharges.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "批准失败");
    },
  });
  const rejectRechargeMutation = trpc.admin.rejectRecharge.useMutation({
    onSuccess: () => {
      toast.success("已拒绝该充值申请");
      utils.admin.getPendingRecharges.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "操作失败");
    },
  });

  const clearAcceptedOrdersMutation = trpc.orders.clearAcceptedOrders.useMutation({
    onSuccess: () => {
      toast.success("已接单记录已清空");
      utils.orders.getAcceptedOrders.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "清空失败");
    },
  });

  const bulkApproveRechargesMutation = trpc.admin.bulkApproveRecharges.useMutation({
    onSuccess: (data) => {
      toast.success(`批量批准成功！共处理 ${data.count} 条请求`);
      utils.admin.getPendingRecharges.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "批量处理失败");
    },
  });

  const clearProcessedRechargesMutation = trpc.admin.clearProcessedRecharges.useMutation({
    onSuccess: () => {
      toast.success("已处理的记录已清空");
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
      toast.success("接单成功！");
      await utils.orders.getPending.refetch();
      await utils.orders.getAcceptedOrders.refetch();
    } catch (error: any) {
      toast.error(error.message || "接单失败");
    }
  };

  const handleCompleteOrder = async (orderId: number) => {
    try {
      await completeOrderMutation.mutateAsync({ orderId });
      toast.success("任务已完成！");
      await utils.orders.getAcceptedOrders.refetch();
      await utils.orders.getMyOrders.refetch();
    } catch (error: any) {
      toast.error(error.message || "操作失败");
    }
  };

  // 🤖 DeepSeek AI 生成魔法 (生成的文案依然保持浪漫质感)
  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error("✨ 请先输入一点灵感提示");
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer sk-023541fc857a47b48f9de4abdd0a38a9`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: "你是一个优秀的创意编剧。请根据用户的简单提示，生成一个浪漫或有趣的互动任务文案。必须严格返回 JSON 格式，包含两个字段：'title' (简短的标题) 和 'description' (详细、有画面感的任务描述)。"
            },
            {
              role: "user",
              content: `提示词：${aiPrompt}`
            }
          ],
          response_format: { type: "json_object" }
        }),
      });

      const data = await response.json();
      const result = JSON.parse(data.choices[0].message.content);

      setOrderTitle(result.title || "");
      setOrderDesc(result.description || "");
      toast.success("✨ 内容生成成功！");
    } catch (error) {
      console.error(error);
      toast.error("生成失败，请检查网络配置");
    } finally {
      setIsGenerating(false);
    }
  };

  // 公共星空背景样式
  const starryBgClass = "min-h-screen bg-[url('https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1920&auto=format&fit=crop')] bg-cover bg-center bg-fixed bg-no-repeat bg-black/60 bg-blend-overlay";

  // ==================== 登录/注册页面 ====================
  if (!currentUser) {
    return (
      <div className={`${starryBgClass} flex items-center justify-center p-4 relative overflow-hidden`}>
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-8 w-full max-w-md relative z-10">
          <h1 className="text-4xl font-bold text-center mb-8 text-white tracking-widest drop-shadow-lg">
            系统登录
          </h1>

          {currentPage === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <h2 className="text-2xl font-bold mb-6 text-white">欢迎回来</h2>
              <input
                type="text"
                placeholder="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-white placeholder-gray-300 transition-all shadow-inner"
              />
              <input
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-white placeholder-gray-300 transition-all shadow-inner"
              />
              <Button type="submit" className="w-full py-3 text-lg font-bold rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/40 border-none transition-transform hover:scale-[1.02]">
                登录
              </Button>
              <p className="text-center text-white/80 font-medium mt-6">
                还没有账号？
                <button
                  type="button"
                  onClick={() => setCurrentPage("register")}
                  className="text-pink-300 hover:text-pink-100 hover:underline ml-2 font-semibold transition-colors"
                >
                  点击注册
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-2xl font-bold mb-6 text-white">创建账号</h2>
              <input
                type="text"
                placeholder="设置用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-white placeholder-gray-300 transition-all shadow-inner"
              />
              <input
                type="password"
                placeholder="设置密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-white placeholder-gray-300 transition-all shadow-inner"
              />
              <Button type="submit" className="w-full py-3 text-lg font-bold rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/40 border-none transition-transform hover:scale-[1.02]">
                注册
              </Button>
              <p className="text-center text-white/80 font-medium mt-6">
                已有账号？
                <button
                  type="button"
                  onClick={() => setCurrentPage("login")}
                  className="text-pink-300 hover:text-pink-100 hover:underline ml-2 font-semibold transition-colors"
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
      <div className={starryBgClass}>
        <div className="bg-white/5 backdrop-blur-md border-b border-white/10 shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-white tracking-widest drop-shadow-md">工作台</h1>
            <Button variant="outline" onClick={handleLogout} className="bg-white/10 border-white/20 text-pink-300 hover:bg-white/20 hover:text-pink-100 hover:border-white/30 backdrop-blur-sm transition-all">
              退出登录
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 gap-6 mb-12">
            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg p-8 border-l-4 border-pink-400 border-y border-r border-white/10 transition-all hover:bg-white/15">
              <p className="text-white/70 text-sm font-medium mb-2 tracking-wider">账户余额</p>
              <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-purple-300 drop-shadow-sm">¥ {balance}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg p-8 border-l-4 border-purple-400 border-y border-r border-white/10 transition-all hover:bg-white/15">
              <p className="text-white/70 text-sm font-medium mb-2 tracking-wider">进行中的任务</p>
              <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-indigo-300 drop-shadow-sm">{pendingCount} 个</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <button onClick={() => setCurrentPage("recharge-approval")} className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-lg hover:shadow-pink-500/20 hover:bg-white/10 transition-all duration-300 p-8 text-center hover:-translate-y-2">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300 drop-shadow-lg">💎</div>
              <h3 className="text-2xl font-bold text-white mb-2 tracking-wide">账户充值</h3>
              <p className="text-white/60 text-sm">为您的账户充值余额</p>
              <div className="mt-6 text-pink-300 font-semibold tracking-widest text-sm group-hover:text-pink-200 transition-colors">去充值 ✦</div>
            </button>

            <button onClick={() => setCurrentPage("create-order")} className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-lg hover:shadow-purple-500/20 hover:bg-white/10 transition-all duration-300 p-8 text-center hover:-translate-y-2">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300 drop-shadow-lg">📝</div>
              <h3 className="text-2xl font-bold text-white mb-2 tracking-wide">发布新任务</h3>
              <p className="text-white/60 text-sm">创建并发布新的互动任务</p>
              <div className="mt-6 text-purple-300 font-semibold tracking-widest text-sm group-hover:text-purple-200 transition-colors">去发布 ✦</div>
            </button>

            <button onClick={() => setCurrentPage("my-orders")} className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-lg hover:shadow-indigo-500/20 hover:bg-white/10 transition-all duration-300 p-8 text-center hover:-translate-y-2">
              <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300 drop-shadow-lg">📖</div>
              <h3 className="text-2xl font-bold text-white mb-2 tracking-wide">任务记录</h3>
              <p className="text-white/60 text-sm">查看所有历史任务记录</p>
              <div className="mt-6 text-indigo-300 font-semibold tracking-widest text-sm group-hover:text-indigo-200 transition-colors">查看记录 ✦</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 充值中心 页面 ====================
  if (userRole === "customer" && currentPage === "recharge-approval") {
    return (
      <div className={starryBgClass}>
        <div className="bg-white/5 backdrop-blur-md border-b border-white/10 shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <button onClick={() => setCurrentPage("customer-dashboard")} className="text-pink-300 hover:text-pink-100 font-semibold flex items-center gap-2 transition-colors self-start">
              ← 返回主页
            </button>
            <h1 className="text-2xl font-bold text-white tracking-widest drop-shadow-md">💎 账户充值</h1>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl p-8 hover:shadow-blue-500/20 transition-all hover:-translate-y-1">
            <h2 className="text-xl font-bold text-white mb-6 tracking-wide text-center">支付宝扫码充值</h2>
            <div className="bg-black/30 border border-white/10 rounded-xl p-8 flex flex-col items-center group transition-all">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663411531548/geonz6r78k6o6GjBy94wRM/pasted_file_idScCb_df3cfd922f408ee98e303139c2b4d00b_e53b7487.jpg"
                alt="收款码"
                className="w-48 h-48 rounded-lg shadow-2xl transition-transform group-hover:scale-110 drop-shadow-[0_0_15px_rgba(37,99,235,0.4)]"
              />
              <p className="text-white/80 text-sm mt-6 text-center tracking-wider bg-white/5 px-4 py-1 rounded-full border border-white/10">请使用支付宝扫描二维码支付</p>
            </div>
          </div>
          <form onSubmit={handleRecharge} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl p-8 space-y-6 hover:shadow-pink-500/20 transition-all hover:-translate-y-1">
            <div>
              <label className="block text-white font-semibold mb-3 tracking-wider">充值金额（¥）</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 font-bold text-lg">¥</span>
                <input type="number" step="0.01" min="0.01" value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)} placeholder="0.00" className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-400 text-white placeholder-gray-300 transition-all shadow-inner" required />
              </div>
            </div>
            <Button type="submit" className="w-full py-3.5 text-lg font-bold rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white shadow-lg shadow-pink-500/40 border-none transition-transform hover:scale-[1.02]">
              提交充值申请 ✦
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // ==================== 任务记录 页面 ====================
  if (userRole === "customer" && currentPage === "my-orders") {
    return (
      <div className={starryBgClass}>
        <div className="bg-white/5 backdrop-blur-md border-b border-white/10 shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <button onClick={() => setCurrentPage("customer-dashboard")} className="text-pink-300 hover:text-pink-100 font-semibold flex items-center gap-2 transition-colors self-start">
              ← 返回主页
            </button>
            <h1 className="text-2xl font-bold text-white tracking-widest drop-shadow-md">📖 任务记录</h1>
            <button onClick={() => setShowDeleteConfirm(true)} className="bg-transparent border border-red-500/50 text-red-400 hover:bg-red-500/10 font-medium px-4 py-2 rounded-lg text-sm self-start sm:self-center transition-colors">
              清空记录
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-12">
          {myOrders.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl p-16 text-center flex flex-col items-center group transition-all hover:bg-white/15 hover:shadow-pink-500/10">
              <div className="text-8xl mb-8 group-hover:scale-110 transition-transform duration-300 drop-shadow-lg">📝</div>
              <p className="text-white/60 text-xl font-medium tracking-wide">暂无任务记录</p>
              <Button onClick={() => setCurrentPage("create-order")} className="mt-8 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 border-none px-6 font-bold transition-transform hover:scale-105">
                去发布任务 ✦
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5">
              {myOrders.map((order) => (
                <div key={order.id} className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl p-7 border-l-4 border-l-indigo-400 border-y border-r border-white/10 group transition-all hover:-translate-y-1 hover:bg-white/15">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white tracking-wide group-hover:text-pink-200 transition-colors">{order.title}</h3>
                      <p className="text-white/70 text-sm mt-3 leading-relaxed">{order.description}</p>
                      <div className="flex flex-wrap gap-4 mt-6 text-sm tracking-wide">
                        <span className="text-purple-300 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-400/20">类型: <span className="font-semibold">{order.type}</span></span>
                        <span className="text-pink-300 bg-pink-500/10 px-3 py-1 rounded-full border border-pink-400/20">任务报价: <span className="font-semibold text-lg">¥{order.price}</span></span>
                        <span className="text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-400/20">状态: <span className="font-semibold uppercase">{order.status}</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent className="bg-gray-900 border border-white/10 rounded-2xl">
            <AlertDialogTitle className="text-white">确认清空所有任务记录？</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70 leading-relaxed mt-2">此操作将永久删除所有待接单的记录，此操作无法撤销。</AlertDialogDescription>
            <div className="flex gap-4 mt-8">
              <AlertDialogCancel className="bg-white/10 border border-white/10 text-white hover:bg-white/20">取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAll} className="bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 border-none text-white font-bold">确认清空</AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ==================== 发布任务 页面 ====================
  if (userRole === "customer" && currentPage === "create-order") {
    return (
      <div className={starryBgClass}>
        <div className="bg-white/5 backdrop-blur-md border-b border-white/10 shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <button onClick={() => setCurrentPage("customer-dashboard")} className="text-pink-300 hover:text-pink-100 font-semibold flex items-center gap-2 transition-colors self-start">
              ← 返回主页
            </button>
            <h1 className="text-2xl font-bold text-white tracking-widest drop-shadow-md">📝 发布新任务</h1>
            <div className="w-20 hidden sm:block"></div>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-6 py-8">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-8 space-y-8">
            {/* 🤖 DeepSeek AI 助手 */}
            <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-pink-400/30 rounded-xl p-6 shadow-inner relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 text-6xl opacity-10 group-hover:scale-110 transition-transform">✨</div>
              <h3 className="text-lg font-bold text-pink-200 mb-3 flex items-center gap-2"><span>🤖</span> AI 灵感助手</h3>
              <p className="text-white/60 text-sm mb-4">输入简单的提示，让 AI 自动为你生成详细的任务文案。</p>
              <div className="flex gap-3">
                <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="例如：设计一个海边周末出游计划..." className="flex-1 px-4 py-3 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 text-white placeholder-gray-400 transition-all shadow-inner" />
                <Button type="button" onClick={handleAIGenerate} disabled={isGenerating} className="bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl px-6 transition-all shadow-lg shadow-pink-600/30">
                  {isGenerating ? "生成中..." : "一键生成 ✦"}
                </Button>
              </div>
            </div>
            <div className="h-px bg-white/10 w-full my-4"></div>
            <form onSubmit={handleCreateOrder} className="space-y-6">
              <div>
                <label className="block text-pink-200 font-semibold mb-2 text-sm tracking-wide">任务标题 <span className="text-pink-500">*</span></label>
                <input type="text" value={orderTitle} onChange={(e) => setOrderTitle(e.target.value)} placeholder="输入标题或由 AI 生成..." className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 text-white placeholder-gray-400 transition-all shadow-inner" required />
              </div>
              <div>
                <label className="block text-pink-200 font-semibold mb-2 text-sm tracking-wide">任务描述</label>
                <textarea value={orderDesc} onChange={(e) => setOrderDesc(e.target.value)} placeholder="详细描述具体要求..." className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 text-white placeholder-gray-400 transition-all shadow-inner h-32 resize-none" />
              </div>
              <div>
                <label className="block text-pink-200 font-semibold mb-2 text-sm tracking-wide">任务类型 <span className="text-pink-500">*</span></label>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {allOrderTypes.map((type) => (
                      <button key={type} type="button" onClick={() => { setOrderType(type); setShowCustomTypeInput(false); }} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${orderType === type && !showCustomTypeInput ? "bg-purple-500/80 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.4)]" : "bg-white/5 text-white/70 border-white/20 hover:bg-white/10 hover:text-white"}`}>
                        {type}
                      </button>
                    ))}
                    <button type="button" onClick={() => { setShowCustomTypeInput(true); setCustomTypeInput(""); }} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${showCustomTypeInput ? "bg-pink-500/80 text-white border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.4)]" : "bg-transparent text-pink-300 border-dashed border-pink-400/50 hover:bg-pink-500/10"}`}>
                      + 自定义类型
                    </button>
                  </div>
                  {showCustomTypeInput && (
                    <div className="flex gap-2 mt-2">
                      <input type="text" value={customTypeInput} onChange={(e) => setCustomTypeInput(e.target.value)} placeholder="输入自定义类型..." className="flex-1 px-4 py-2 bg-black/30 border border-pink-400/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 text-white placeholder-gray-500 shadow-inner" autoFocus />
                      <button type="button" onClick={() => { if (customTypeInput.trim()) { setOrderType(customTypeInput.trim()); setShowCustomTypeInput(false); } }} className="px-4 py-2 bg-pink-600/80 text-white rounded-xl hover:bg-pink-500 font-medium text-sm transition-colors border border-pink-400">确认</button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-pink-200 font-semibold mb-2 text-sm tracking-wide">任务报价（¥） <span className="text-pink-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 font-semibold">¥</span>
                  <input type="number" step="0.01" min="0.01" value={orderPrice} onChange={(e) => setOrderPrice(e.target.value)} placeholder="0.00" className="w-full pl-8 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-400 text-white placeholder-gray-400 transition-all shadow-inner" required />
                </div>
              </div>
              <Button type="submit" className="w-full py-4 text-lg font-bold tracking-widest rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/40 border-none transition-all hover:scale-[1.02]" disabled={createOrderMutation.isPending}>
                {createOrderMutation.isPending ? "发布中..." : "🚀 确认发布"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 商家端公共样式覆盖 ====================
  if (userRole === "merchant" && currentPage === "merchant-dashboard") {
    return (
      <div className={starryBgClass}>
        <div className="bg-white/5 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-white tracking-widest">🏪 管理控制台</h1>
            <Button variant="outline" onClick={handleLogout} className="bg-white/10 border-white/20 text-red-400 hover:bg-white/20 hover:text-red-300">退出登录</Button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <button onClick={() => setCurrentPage("account")} className="group bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-lg hover:bg-white/15 transition-all duration-300 p-8 text-center">
              <div className="text-6xl mb-4">📡</div>
              <h3 className="text-2xl font-bold text-white mb-2">待处理任务</h3>
              <p className="text-white/60 text-sm">查看所有待接单任务</p>
            </button>
            <button onClick={() => setCurrentPage("accepted-orders")} className="group bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-lg hover:bg-white/15 transition-all duration-300 p-8 text-center">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-2xl font-bold text-white mb-2">进行中任务</h3>
              <p className="text-white/60 text-sm">管理已接单的任务</p>
            </button>
            <button onClick={() => setCurrentPage("recharge-approval")} className="group bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-lg hover:bg-white/15 transition-all duration-300 p-8 text-center">
              <div className="text-6xl mb-4">💎</div>
              <h3 className="text-2xl font-bold text-white mb-2">充值审核</h3>
              <p className="text-white/60 text-sm">审核用户的充值请求</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (userRole === "merchant" && currentPage === "account") {
    return (
      <div className={starryBgClass}>
        <div className="bg-white/5 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <button onClick={() => setCurrentPage("merchant-dashboard")} className="text-pink-300 hover:text-pink-100 font-semibold flex items-center gap-2 mb-4">← 返回控制台</button>
            <h1 className="text-2xl font-bold text-white">📡 待处理任务</h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-8">
          {pendingOrders.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-12 text-center text-white/60">暂无待接单任务</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingOrders.map((order) => (
                <div key={order.id} className="bg-white/10 backdrop-blur-md rounded-xl p-6 border-l-4 border-green-500">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white">{order.title}</h3>
                      <p className="text-white/70 text-sm mt-2">{order.description}</p>
                      <div className="flex gap-4 mt-4 text-sm text-white/80">
                        <span>类型: {order.type}</span>
                        <span>报价: ¥{order.price}</span>
                      </div>
                    </div>
                    <Button onClick={() => handleAcceptOrder(order.id)} className="bg-green-600 hover:bg-green-500 text-white">接单</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (userRole === "merchant" && currentPage === "accepted-orders") {
    return (
      <div className={starryBgClass}>
        <div className="bg-white/5 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <button onClick={() => setCurrentPage("merchant-dashboard")} className="text-pink-300 hover:text-pink-100 font-semibold flex items-center gap-2 mb-4">← 返回控制台</button>
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-white">✅ 进行中任务</h1>
              <Button onClick={() => { if (confirm("确定要清空？")) clearAcceptedOrdersMutation.mutate(); }} variant="destructive" className="bg-red-600/80 hover:bg-red-500 text-white">一键清空</Button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-8">
          {acceptedOrders.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-12 text-center text-white/60">暂无进行中的任务</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {acceptedOrders.map((order) => (
                <div key={order.id} className="bg-white/10 backdrop-blur-md rounded-xl p-6 border-l-4 border-blue-500">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white">{order.title}</h3>
                      <p className="text-white/70 text-sm mt-2">{order.description}</p>
                      <div className="flex gap-4 mt-4 text-sm text-white/80">
                        <span>类型: {order.type}</span>
                        <span>报价: ¥{order.price}</span>
                      </div>
                    </div>
                    <Button onClick={() => handleCompleteOrder(order.id)} className="bg-blue-600 hover:bg-blue-500 text-white">完成任务</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (userRole === "merchant" && currentPage === "recharge-approval") {
    return (
      <div className={starryBgClass}>
        <div className="bg-white/5 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <button onClick={() => setCurrentPage("merchant-dashboard")} className="text-pink-300 hover:text-pink-100 font-semibold flex items-center gap-2 mb-4">← 返回控制台</button>
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-white">💎 充值审核</h1>
              <div className="flex gap-3">
                <Button onClick={() => { if (confirm("确定批量批准？")) bulkApproveRechargesMutation.mutate(); }} className="bg-green-600/80 hover:bg-green-500 text-white">批量批准</Button>
                <Button onClick={() => { if (confirm("确定清空？")) clearProcessedRechargesMutation.mutate(); }} className="bg-red-600/80 hover:bg-red-500 text-white">清空已处理</Button>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-8">
          {!pendingRecharges || pendingRecharges.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-12 text-center text-white/60">暂无待审核的充值请求</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pendingRecharges.map((recharge: any) => (
                <div key={recharge.id} className="bg-white/10 backdrop-blur-md rounded-xl p-6 border-l-4 border-yellow-500">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 text-white">
                      <h3 className="text-lg font-bold">充值请求</h3>
                      <p className="text-white/70 text-sm mt-2">用户 ID: {recharge.userId}</p>
                      <div className="flex gap-4 mt-4 text-sm text-white/80">
                        <span>金额: ¥{recharge.amount}</span>
                        <span>状态: {recharge.status}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => approveRechargeMutation.mutate({ rechargeId: recharge.id })} className="bg-green-600 hover:bg-green-500 text-white">批准</Button>
                      <Button onClick={() => rejectRechargeMutation.mutate({ rechargeId: recharge.id })} variant="destructive">拒绝</Button>
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