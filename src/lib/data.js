import { supabase } from "./supabase";

export const DEFAULT_CATEGORIES = [
  { name: "Moradia", kind: "expense", color: "#f29b68", icon: "⌂" },
  { name: "Alimentação", kind: "expense", color: "#e9c46a", icon: "◉" },
  { name: "Transporte", kind: "expense", color: "#7da5d8", icon: "↗" },
  { name: "Saúde", kind: "expense", color: "#85b8a4", icon: "+" },
  { name: "Lazer", kind: "expense", color: "#b495cb", icon: "✳" },
  { name: "Salário", kind: "income", color: "#58a88d", icon: "↑" },
  { name: "Freelance", kind: "income", color: "#73a9c5", icon: "↗" },
];

export function getErrorMessage(error) {
  if (!error) return "Ocorreu um erro inesperado. Tente novamente.";
  if (error.code === "23505") return "Este item já existe.";
  if (error.code === "23503") return "Não foi possível concluir: há dados relacionados.";
  if (error.message?.toLowerCase().includes("failed to fetch")) {
    return "Não foi possível conectar ao Supabase. Verifique sua conexão e configuração.";
  }
  return error.message || "Ocorreu um erro inesperado. Tente novamente.";
}

export async function loadFinanceData() {
  const [accountsResult, categoriesResult, transactionsResult, budgetsResult] =
    await Promise.all([
      supabase.from("accounts").select("*").order("created_at"),
      supabase.from("categories").select("*").order("name"),
      supabase
        .from("transactions")
        .select("*, accounts(name), categories(name, color, icon)")
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("budgets").select("*, categories(name, color, icon)"),
    ]);

  const firstError = [
    accountsResult,
    categoriesResult,
    transactionsResult,
    budgetsResult,
  ].find((result) => result.error)?.error;
  if (firstError) throw firstError;

  return {
    accounts: accountsResult.data,
    categories: categoriesResult.data,
    transactions: transactionsResult.data,
    budgets: budgetsResult.data,
  };
}

export async function ensureDefaultCategories(userId) {
  const seedKey = `fluxo-default-categories-seeded:${userId}`;
  if (localStorage.getItem(seedKey) === "true") return;

  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  if (error) throw error;
  if (!data.length) {
    const { error: insertError } = await supabase
      .from("categories")
      .upsert(DEFAULT_CATEGORIES.map((category) => ({ ...category, user_id: userId })), {
        onConflict: "user_id,name,kind",
        ignoreDuplicates: true,
      });
    if (insertError) throw insertError;
  }
  localStorage.setItem(seedKey, "true");
}
