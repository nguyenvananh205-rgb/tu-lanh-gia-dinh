import { useState, useEffect, useCallback } from "react";
import {
  RefrigeratorIcon, CalendarDays, ShoppingCart, Lightbulb,
  LayoutDashboard, Settings, Plus, Share2, LogOut, UserCheck, RefreshCw
} from "lucide-react";
import { DEFAULT_RECIPES } from "./data/defaultRecipes";
import type { FoodItem, MealPlan, ShoppingItem, Recipe, Fridge } from "./types";
import Dashboard from "./components/Dashboard";
import FridgeInventory from "./components/FridgeInventory";
import ApiKeySettings from "./components/ApiKeySettings";
import MealPlanner from "./components/MealPlanner";
import MealSuggestions from "./components/MealSuggestions";
import ShoppingList from "./components/ShoppingList";
import InstallBanner from "./components/InstallBanner";
import SmartAddModal from "./components/SmartAddModal";
import FoodAddedToast from "./components/FoodAddedToast";
import SplashScreen from "./components/SplashScreen";
import AuthScreen from "./components/AuthScreen";
import FridgeSelector from "./components/FridgeSelector";
import ShareCodePanel from "./components/ShareCodePanel";
import { useNotifications } from "./hooks/useNotifications";
import { startOnboardingTour } from "./hooks/useOnboarding";
import { useAuth } from "./hooks/useAuth";
import { useFridgeData, useLocalFridgeStore } from "./hooks/useFridgeData";
import { isSupabaseConfigured } from "./lib/supabase";
import type { FoodCategory } from "./types";

const TABS = [
  { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { id: "fridge", label: "Tủ lạnh", icon: RefrigeratorIcon },
  { id: "suggestions", label: "Gợi ý món", icon: Lightbulb },
  { id: "planner", label: "Kế hoạch", icon: CalendarDays },
  { id: "shopping", label: "Mua sắm", icon: ShoppingCart },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Loading screen ──────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
          <RefrigeratorIcon size={24} className="text-white" />
        </div>
        <div className="w-6 h-6 border-2 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Đang tải...</p>
      </div>
    </div>
  );
}

// ── Main app wrapper ──────────────────────────────────────────────────────────
function MainApp({
  activeFridge,
  guestFridgeId,
  guestFridgeName,
  onSwitchFridge,
  onShowRegister,
}: {
  activeFridge: Fridge | null;
  guestFridgeId: string | null;
  guestFridgeName: string | null;
  onSwitchFridge: () => void;
  onShowRegister?: () => void;
}) {
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem("splashShown"));
  const [tourQueued, setTourQueued] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [showSettings, setShowSettings] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [toast, setToast] = useState<{ name: string; category: FoodCategory } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    try {
      const raw = localStorage.getItem("fridge_recipes");
      return raw ? JSON.parse(raw) : DEFAULT_RECIPES;
    } catch { return DEFAULT_RECIPES; }
  });

  // Determine which fridge to use
  const fridgeId = activeFridge?.id ?? guestFridgeId;
  const isGuest = !activeFridge && !!guestFridgeId;
  const isOwner = activeFridge?.role === "owner";

  // Supabase-backed fridge data
  const fridgeData = useFridgeData(
    isSupabaseConfigured ? fridgeId ?? null : null,
    isGuest ? "Vãng lai" : undefined
  );

  // Local store (fallback when Supabase not configured)
  const localStore = useLocalFridgeStore();

  // Choose data source
  const foods = isSupabaseConfigured ? fridgeData.foods : localStore.foods;
  const meals = isSupabaseConfigured ? fridgeData.meals : localStore.meals;
  const shopping = isSupabaseConfigured ? fridgeData.shopping : localStore.shopping;

  const { requestPermission } = useNotifications(foods);

  // ── Food handlers ──────────────────────────────────────────────
  const handleAddFood = async (item: FoodItem) => {
    if (isSupabaseConfigured) {
      const { id: _id, ...rest } = item;
      await fridgeData.addFood(rest);
    } else {
      localStore.setFoods((prev) => [...prev, item]);
    }
    setToast({ name: item.name, category: item.category });
  };

  const handleUpdateFood = async (item: FoodItem) => {
    if (isSupabaseConfigured) {
      await fridgeData.updateFood(item);
    } else {
      localStore.setFoods((prev) => prev.map((f) => f.id === item.id ? item : f));
    }
  };

  const handleDeleteFood = async (id: string) => {
    if (isSupabaseConfigured) {
      await fridgeData.deleteFood(id);
    } else {
      localStore.setFoods((prev) => prev.filter((f) => f.id !== id));
    }
  };

  // ── Meal handlers ──────────────────────────────────────────────
  const handleAddMeal = async (meal: MealPlan) => {
    if (isSupabaseConfigured) {
      const { id: _id, ingredientIds: _iids, ...rest } = meal;
      await fridgeData.addMeal(rest);
    } else {
      localStore.setMeals((prev) => [...prev, meal]);
    }
  };

  const handleDeleteMeal = async (id: string) => {
    if (isSupabaseConfigured) {
      await fridgeData.deleteMeal(id);
    } else {
      localStore.setMeals((prev) => prev.filter((m) => m.id !== id));
    }
  };

  // ── Shopping handlers ──────────────────────────────────────────
  const handleAddShopping = async (item: ShoppingItem) => {
    if (isSupabaseConfigured) {
      const { id: _id, ...rest } = item;
      await fridgeData.addShopping(rest);
    } else {
      localStore.setShopping((prev) => [...prev, item]);
    }
  };

  const handleAddManyShopping = async (items: ShoppingItem[]) => {
    if (isSupabaseConfigured) {
      await fridgeData.addManyShopping(items.map(({ id: _id, ...rest }) => rest));
    } else {
      localStore.setShopping((prev) => [...prev, ...items]);
    }
  };

  // ShoppingList calls onToggle(id) — we look up the current checked state and invert it
  const handleToggleShopping = async (id: string) => {
    const current = shopping.find((s) => s.id === id);
    if (!current) return;
    if (isSupabaseConfigured) {
      await fridgeData.toggleShopping(id, !current.checked);
    } else {
      localStore.setShopping((prev) => prev.map((i) => i.id === id ? { ...i, checked: !i.checked } : i));
    }
  };

  const handleDeleteShopping = async (id: string) => {
    if (isSupabaseConfigured) {
      await fridgeData.deleteShopping(id);
    } else {
      localStore.setShopping((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const handleClearChecked = async () => {
    if (isSupabaseConfigured) {
      await fridgeData.clearCheckedShopping();
    } else {
      localStore.setShopping((prev) => prev.filter((i) => !i.checked));
    }
  };

  // ── Cook / recipe handlers ─────────────────────────────────────
  const handleCookFoods = (updatedFoods: FoodItem[]) => {
    if (isSupabaseConfigured) {
      fridgeData.setFoods(updatedFoods);
    } else {
      localStore.setFoods(updatedFoods);
    }
  };

  const handleAddShoppingFromRecipe = (items: ShoppingItem[]) => {
    handleAddManyShopping(items);
  };

  const handleAddFoodFromRecipe = (item: FoodItem) => {
    handleAddFood(item);
  };

  const handleSaveRecipes = (newRecipes: Recipe[]) => {
    setRecipes(newRecipes);
    localStorage.setItem("fridge_recipes", JSON.stringify(newRecipes));
  };

  // ── Refresh ─────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (isSupabaseConfigured) {
        await fridgeData.refresh();
      } else {
        localStore.reload();
      }
      setLastRefreshed(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, fridgeData, localStore]);

  const uncheckedShopping = shopping.filter((i) => !i.checked).length;

  const TAB_TITLES: Record<TabId, string> = {
    dashboard: "Tổng quan",
    fridge: "Tủ lạnh",
    suggestions: "Gợi ý món ăn",
    planner: "Kế hoạch bữa ăn",
    shopping: "Danh sách mua sắm",
  };

  const showFab = activeTab === "dashboard" || activeTab === "fridge";

  const handleSplashDone = () => {
    sessionStorage.setItem("splashShown", "1");
    setShowSplash(false);
  };

  const handleSplashExplore = () => {
    sessionStorage.setItem("splashShown", "1");
    setShowSplash(false);
    setTourQueued(true);
  };

  useEffect(() => {
    if (!tourQueued) return;
    const t = setTimeout(() => {
      startOnboardingTour((tab) => setActiveTab(tab as TabId));
      setTourQueued(false);
    }, 420);
    return () => clearTimeout(t);
  }, [tourQueued]);

  const fridgeName = activeFridge?.name ?? guestFridgeName ?? "Tủ lạnh";

  return (
    <div className="fridge-bg">
      {showSplash && <SplashScreen onDone={handleSplashDone} onExplore={handleSplashExplore} />}

      {/* Header */}
      <header data-tour="header" className="fridge-header sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <RefrigeratorIcon size={19} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-800 leading-tight tracking-tight truncate max-w-[160px] sm:max-w-xs">
                {fridgeName}
              </h1>
              {isGuest ? (
                <span className="text-[11px] text-amber-600 font-medium leading-tight flex items-center gap-1">
                  <UserCheck size={10} />
                  Vãng lai
                </span>
              ) : (
                <p className="text-[11px] text-slate-400 leading-tight">Quản lý thực phẩm thông minh</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              data-tour="btn-add-header"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-sm font-medium transition-all active:scale-95 shadow-sm"
            >
              <Plus size={16} />
              Thêm
            </button>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="relative p-2 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              title={lastRefreshed ? `Làm mới · cập nhật lúc ${lastRefreshed.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Làm mới dữ liệu"}
            >
              <RefreshCw
                size={18}
                className={`text-slate-400 transition-transform ${refreshing ? "animate-spin" : "hover:text-emerald-500"}`}
              />
              {lastRefreshed && !refreshing && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full" />
              )}
            </button>

            {/* Share code button — only for fridge owners */}
            {isOwner && activeFridge && (
              <button
                onClick={() => setShowSharePanel(true)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                title="Mã chia sẻ"
              >
                <Share2 size={18} className="text-slate-400" />
              </button>
            )}

            {/* Switch fridge / logout for logged-in users */}
            {!isGuest && (
              <button
                onClick={onSwitchFridge}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                title="Chuyển tủ lạnh / Đăng xuất"
              >
                <LogOut size={18} className="text-slate-400" />
              </button>
            )}

            <button
              data-tour="btn-settings"
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              title="Cài đặt AI"
            >
              <Settings size={18} className="text-slate-400" />
            </button>
          </div>
        </div>
      </header>

      <InstallBanner onRequestNotifications={requestPermission} />

      {/* Tab nav */}
      <nav className="fridge-tabs sticky top-[57px] z-30">
        <div className="max-w-4xl mx-auto px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-0 min-w-max">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                data-tour={`tab-${id}`}
                onClick={() => setActiveTab(id)}
                className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === id
                    ? "text-emerald-600 border-b-2 border-emerald-500 bg-emerald-50/60"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50/80 border-b-2 border-transparent"
                }`}
              >
                <Icon size={15} />
                {label}
                {id === "shopping" && uncheckedShopping > 0 && (
                  <span className="absolute -top-0.5 right-1.5 w-4 h-4 bg-emerald-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                    {uncheckedShopping > 9 ? "9+" : uncheckedShopping}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="fridge-light-strip" />
      </nav>

      {/* Main content */}
      <main data-tour="main-content" className="max-w-4xl mx-auto px-4 pt-5 pb-28">
        <div key={activeTab} className="fridge-enter">
          <h2 className="text-xl font-bold text-slate-700 mb-5 tracking-tight">{TAB_TITLES[activeTab]}</h2>

          {activeTab === "dashboard" && (
            <Dashboard
              foods={foods}
              meals={meals}
              shoppingCount={uncheckedShopping}
              onTabChange={(tab) => setActiveTab(tab as TabId)}
              onAddFood={() => setShowAddModal(true)}
            />
          )}
          {activeTab === "fridge" && (
            <FridgeInventory
              foods={foods}
              onUpdate={handleUpdateFood}
              onDelete={handleDeleteFood}
              onOpenAdd={() => setShowAddModal(true)}
            />
          )}
          {activeTab === "suggestions" && (
            <MealSuggestions
              foods={foods}
              recipes={recipes}
              onCook={handleCookFoods}
              onAddShopping={handleAddShoppingFromRecipe}
              onAddFood={handleAddFoodFromRecipe}
              onSaveRecipes={handleSaveRecipes}
            />
          )}
          {activeTab === "planner" && (
            <MealPlanner
              foods={foods}
              meals={meals}
              onAdd={handleAddMeal}
              onDelete={handleDeleteMeal}
            />
          )}
          {activeTab === "shopping" && (
            <ShoppingList
              items={shopping}
              foods={foods}
              meals={meals}
              recipes={recipes}
              onAdd={handleAddShopping}
              onAddMany={handleAddManyShopping}
              onToggle={handleToggleShopping}
              onDelete={handleDeleteShopping}
              onClearChecked={handleClearChecked}
            />
          )}
        </div>
      </main>

      {/* FAB */}
      {showFab && (
        <button
          data-tour="fab"
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-6 right-4 z-40 flex items-center gap-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white pl-4 pr-5 py-3.5 rounded-2xl shadow-xl font-semibold text-sm transition-all active:scale-95"
          style={{ boxShadow: "0 4px 20px rgba(16,185,129,0.45)" }}
        >
          <Plus size={20} />
          Thêm thực phẩm
        </button>
      )}

      {showAddModal && (
        <SmartAddModal
          onSave={handleAddFood}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {toast && (
        <FoodAddedToast
          name={toast.name}
          category={toast.category}
          onDone={() => setToast(null)}
        />
      )}

      {/* Guest CTA — fixed bottom bar, always visible for guest users */}
      {isGuest && onShowRegister && (
        <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-2 bg-gradient-to-t from-white/95 to-transparent pointer-events-none">
          <button
            onClick={onShowRegister}
            className="pointer-events-auto w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.98] text-white font-semibold py-3.5 rounded-2xl shadow-lg text-[15px] transition-all"
            style={{ boxShadow: "0 4px 20px rgba(16,185,129,0.40)" }}
          >
            <RefrigeratorIcon size={18} />
            Tạo tủ lạnh của tôi
          </button>
        </div>
      )}

      {showSettings && <ApiKeySettings onClose={() => setShowSettings(false)} />}

      {showSharePanel && activeFridge && (
        <ShareCodePanel
          fridge={activeFridge}
          onClose={() => setShowSharePanel(false)}
        />
      )}
    </div>
  );
}

// ── Root App component ──────────────────────────────────────────────────────
export default function App() {
  const auth = useAuth();
  const [activeFridge, setActiveFridge] = useState<Fridge | null>(null);
  const [guestFridgeId, setGuestFridgeId] = useState<string | null>(null);
  const [guestFridgeName, setGuestFridgeName] = useState<string | null>(null);
  const [showFridgeSelector, setShowFridgeSelector] = useState(false);
  const [showRegisterForGuest, setShowRegisterForGuest] = useState(false);

  // Capture ?join=CODE from URL on first load and stash it for FridgeSelector
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("join");
    if (code) {
      sessionStorage.setItem("pendingJoinCode", code.toUpperCase());
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // When user logs out, clear fridge state
  const handleSignOut = async () => {
    await auth.signOut();
    setActiveFridge(null);
    setGuestFridgeId(null);
    setGuestFridgeName(null);
    setShowFridgeSelector(false);
  };

  // When session changes (login/logout), reset fridge selection
  useEffect(() => {
    if (!auth.session) {
      setActiveFridge(null);
      setShowFridgeSelector(false);
    }
  }, [auth.session]);

  // ── Loading state ──────────────────────────────────────────────
  if (auth.loading) {
    return <LoadingScreen />;
  }

  // ── Supabase not configured — run in local-only mode ──────────
  if (!isSupabaseConfigured) {
    return (
      <MainApp
        activeFridge={null}
        guestFridgeId="local"
        guestFridgeName="Tủ lạnh gia đình"
        onSwitchFridge={() => {}}
      />
    );
  }

  // ── Not authenticated and not a guest ─────────────────────────
  if (!auth.session && !guestFridgeId) {
    return (
      <AuthScreen
        auth={auth}
        onGuestAccess={(fridgeId, fridgeName) => {
          setGuestFridgeId(fridgeId);
          setGuestFridgeName(fridgeName);
        }}
      />
    );
  }

  // ── Authenticated but needs to select/switch fridge ───────────
  if (auth.session && auth.user && (!activeFridge || showFridgeSelector)) {
    return (
      <FridgeSelector
        user={auth.user}
        onSelect={(fridge) => {
          setActiveFridge(fridge);
          setShowFridgeSelector(false);
        }}
        onSignOut={handleSignOut}
      />
    );
  }

  // ── Guest wants to create an account ─────────────────────────
  if (guestFridgeId && showRegisterForGuest) {
    return (
      <AuthScreen
        auth={auth}
        initialTab="register"
        onGuestAccess={(fridgeId, fridgeName) => {
          setGuestFridgeId(fridgeId);
          setGuestFridgeName(fridgeName);
          setShowRegisterForGuest(false);
        }}
        onClose={() => setShowRegisterForGuest(false)}
      />
    );
  }

  // ── Guest with fridge ID OR authenticated with active fridge ──
  return (
    <MainApp
      activeFridge={activeFridge}
      guestFridgeId={guestFridgeId}
      guestFridgeName={guestFridgeName}
      onSwitchFridge={() => setShowFridgeSelector(true)}
      onShowRegister={() => setShowRegisterForGuest(true)}
    />
  );
}
