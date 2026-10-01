export type FoodLocation = "ngan_lanh" | "ngan_da" | "tu_mat" | "ngoai_tu";

export type FoodCategory =
  | "thit_ca"
  | "rau_cu"
  | "do_nau_chin"
  | "sua_trung"
  | "do_uong"
  | "gia_vi"
  | "trang_miem"
  | "khac";

export type MealType = "bua_trua" | "bua_toi" | "trang_miem";

export interface FoodItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: FoodCategory;
  purchaseDate: string;
  expiryDate: string;
  location?: FoodLocation;
  notes?: string;
}

export interface MealPlan {
  id: string;
  date: string;
  type: MealType;
  mealName: string;
  ingredientIds: string[];
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: FoodCategory;
  checked: boolean;
}

export type ExpiryStatus = "expired" | "critical" | "soon" | "ok";

// ── Auth & Fridge sharing ───────────────────────────────────────
export interface UserProfile {
  id: string;
  phone: string;
  display_name?: string;
}

export interface Fridge {
  id: string;
  name: string;
  owner_id: string;
  share_code: string;
  role: "owner" | "member" | "guest"; // guest = unregistered user with share code
}

// ── Recipe system ──────────────────────────────────────────────
export type RecipePurpose = "com_gia_dinh" | "healthy" | "dac_biet";
export type DishRole = "canh" | "rau" | "chinh" | "phu";

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  optional?: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  purpose: RecipePurpose;
  role: DishRole;
  ingredients: RecipeIngredient[];
  cookTime: number; // minutes
  servings: number;
  notes?: string;
}

export interface MissingIngredient {
  name: string;
  quantity: number;
  unit: string;
  forRecipe: string;
  optional: boolean;
}

export interface IngredientMatch {
  ingredient: RecipeIngredient;
  fridgeItem: FoodItem | null;
  isPartial: boolean; // in fridge but qty < needed
}

export interface ScoredRecipe {
  recipe: Recipe;
  matches: IngredientMatch[];
  availableCount: number;
  totalRequired: number;
  score: number; // 0–100
  expiryBonus: number;
}

export interface ScoredCombo {
  id: string;
  purpose: RecipePurpose;
  canh: ScoredRecipe;
  rau: ScoredRecipe;
  chinh: ScoredRecipe;
  phu: ScoredRecipe;
  totalScore: number;
  missingIngredients: MissingIngredient[];
}

