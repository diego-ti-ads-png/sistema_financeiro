import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  BadgeDollarSign,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Tags,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  ensureDefaultCategories,
  getErrorMessage,
  loadFinanceData,
} from "./lib/data";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ACCOUNT_TYPES = [
  ["checking", "Conta corrente"],
  ["savings", "Poupança"],
  ["cash", "Carteira"],
  ["credit", "Cartão de crédito"],
];
const NAV_ITEMS = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "transactions", label: "Transações", icon: ArrowLeftRight },
  { id: "accounts", label: "Contas", icon: Wallet },
  { id: "budgets", label: "Orçamentos", icon: Target },
  { id: "categories", label: "Categorias", icon: Tags },
];

function currency(value) {
  return money.format(Number(value) || 0);
}

function dateInputValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatError(error) {
  return getErrorMessage(error);
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [page, setPage] = useState("overview");
  const [data, setData] = useState({ accounts: [], categories: [], transactions: [], budgets: [] });
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState("");
  const [mobileNav, setMobileNav] = useState(false);

  const refresh = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoadingData(true);
    setDataError("");
    try {
      await ensureDefaultCategories(session.user.id);
      setData(await loadFinanceData());
    } catch (error) {
      setDataError(formatError(error));
    } finally {
      setLoadingData(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }
    let active = true;
    if (window.location.hash.includes("type=recovery")) setRecoveryMode(true);
    supabase.auth.getSession().then(({ data: result, error }) => {
      if (!active) return;
      if (error) setDataError(formatError(error));
      setSession(result?.session ?? null);
      setAuthLoading(false);
    }).catch((error) => {
      if (!active) return;
      setDataError(formatError(error));
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) refresh();
    else setData({ accounts: [], categories: [], transactions: [], budgets: [] });
  }, [session, refresh]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) setToast(formatError(error));
    } catch (error) {
      setToast(formatError(error));
    }
  }

  async function saveRecord(table, payload, successMessage) {
    const query = table === "budgets"
      ? supabase.from(table).upsert(payload, { onConflict: "user_id,category_id,year,month" })
      : supabase.from(table).insert(payload);
    const { error } = await query;
    if (error) throw error;
    await refresh();
    setModal("");
    setToast(successMessage);
  }

  async function deleteTransaction(id) {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) setToast(formatError(error));
    else {
      setToast("Transação removida.");
      refresh();
    }
  }

  function exportTransactions(transactions = data.transactions) {
    const header = ["Data", "Descrição", "Tipo", "Categoria", "Conta", "Valor"];
    const rows = transactions.map((item) => [
      item.occurred_on,
      item.description,
      item.kind === "income" ? "Receita" : "Despesa",
      item.categories?.name ?? "",
      item.accounts?.name ?? "",
      Number(item.amount).toFixed(2).replace(".", ","),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((field) => `"${String(field).replaceAll('"', '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fluxo-transacoes-${dateInputValue()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setToast("Arquivo CSV exportado.");
  }

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (authLoading) return <FullScreenLoader label="Conectando à sua conta..." />;
  if (recoveryMode) return <RecoveryScreen onComplete={() => setRecoveryMode(false)} />;
  if (!session) return <AuthScreen />;

  const userName =
    session.user.user_metadata?.full_name ||
    session.user.user_metadata?.name ||
    session.user.email?.split("@")[0] ||
    "Minha conta";

  return (
    <div className="app-shell">
      {mobileNav && <button className="mobile-backdrop" aria-label="Fechar menu" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage("overview"); }}>
          <span className="brand-mark"><BadgeDollarSign size={23} /></span>
          <span>fluxo<span className="brand-dot">.</span></span>
        </a>
        <div className="workspace-label">ESPAÇO PESSOAL</div>
        <nav className="main-nav" aria-label="Menu principal">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              className={`nav-item ${page === id ? "nav-active" : ""}`}
              key={id}
              onClick={() => { setPage(id); setMobileNav(false); }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === "transactions" && data.transactions.length > 0 && (
                <span className="nav-count">{data.transactions.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon"><ShieldCheck size={17} /></span>
            <strong>Seus dados, protegidos</strong>
            <p>Suas informações financeiras são privadas e criptografadas.</p>
          </div>
          <button className="nav-item support-link" onClick={() => setPage("help")}>
            <CircleHelp size={18} /><span>Ajuda e suporte</span>
          </button>
          <div className="profile-block">
            <span className="avatar">{userName.slice(0, 1).toUpperCase()}</span>
            <span className="profile-name"><strong>{userName}</strong><small>{session.user.email}</small></span>
            <button className="icon-button logout-button" onClick={signOut} title="Sair" aria-label="Sair da conta">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Abrir menu" onClick={() => setMobileNav(true)}>
            <Menu size={20} />
          </button>
          <div className="breadcrumb"><span>Meu espaço</span><span className="crumb-slash">/</span><strong>{pageTitle(page)}</strong></div>
          <div className="topbar-actions">
            <span className="today-label"><CalendarDays size={15} />{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date())}</span>
            <button className="icon-button notification-button" aria-label="Notificações">
              <Bell size={18} />
              {data.budgets.some((budget) => budgetUsage(budget, data.transactions) >= Number(budget.alert_threshold)) && <i />}
            </button>
          </div>
        </header>

        <div className="content-area">
          {dataError && (
            <div className="error-banner" role="alert">
              <span>{dataError}</span>
              <button onClick={refresh}>Tentar novamente</button>
            </div>
          )}
          {loadingData && <div className="loading-line"><LoaderCircle size={15} className="spin" /> Atualizando seus dados...</div>}
          {page === "overview" && (
            <Dashboard data={data} onNavigate={setPage} onAdd={() => setModal("transaction")} onExport={() => exportTransactions()} />
          )}
          {page === "transactions" && (
            <TransactionsPage data={data} onAdd={() => setModal("transaction")} onDelete={deleteTransaction} onExport={exportTransactions} />
          )}
          {page === "accounts" && (
            <AccountsPage data={data} onAdd={() => setModal("account")} onNavigate={setPage} />
          )}
          {page === "budgets" && (
            <BudgetsPage data={data} onAdd={() => setModal("budget")} />
          )}
          {page === "categories" && (
            <CategoriesPage data={data} onAdd={() => setModal("category")} />
          )}
          {page === "help" && <HelpPage />}
        </div>
      </main>

      {modal && (
        <FinanceModal
          type={modal}
          data={data}
          userId={session.user.id}
          onClose={() => setModal("")}
          onSave={saveRecord}
        />
      )}
      {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}
    </div>
  );
}

function RecoveryScreen({ onComplete }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setComplete(true);
      await supabase.auth.signOut();
    } catch (updateError) {
      setError(formatError(updateError));
    } finally {
      setBusy(false);
    }
  }

  return <div className="auth-page"><div className="auth-wrap"><Brand /><div className="auth-card">
    <span className="auth-eyebrow">RECUPERAÇÃO DE ACESSO</span>
    <h1>Crie uma nova senha</h1>
    <p className="auth-subtitle">Escolha uma senha segura para voltar a acessar sua conta.</p>
    {complete ? <div className="form-alert success-alert">Senha atualizada. Você já pode entrar com sua nova senha.</div> : (
      <form className="form-stack" onSubmit={submit}>
        <label>Nova senha<span className="password-wrap"><input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required autoComplete="new-password" /><button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
        <label>Confirmar nova senha<input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required autoComplete="new-password" /></label>
        {error && <div className="form-alert error-alert" role="alert">{error}</div>}
        <button className="primary-button auth-submit" disabled={busy}>{busy && <LoaderCircle size={17} className="spin" />}Atualizar senha</button>
      </form>
    )}
    {complete && <button className="primary-button auth-submit" onClick={onComplete}>Voltar para o login</button>}
  </div></div></div>;
}

function pageTitle(page) {
  return NAV_ITEMS.find((item) => item.id === page)?.label ?? (page === "help" ? "Ajuda e suporte" : "Visão geral");
}

function FullScreenLoader({ label }) {
  return <div className="full-loader"><LoaderCircle className="spin" size={27} /><span>{label}</span></div>;
}

function SetupNotice() {
  return (
    <div className="auth-page">
      <div className="auth-card setup-card">
        <Brand />
        <span className="auth-eyebrow">CONFIGURAÇÃO NECESSÁRIA</span>
        <h1>Conecte seu projeto Supabase</h1>
        <p>Crie um arquivo <code>.env</code> na raiz e informe a URL do projeto e a chave pública (anon).</p>
        <pre>VITE_SUPABASE_URL=https://...supabase.co{"\n"}VITE_SUPABASE_ANON_KEY=sua-chave-anon</pre>
        <p className="muted">Consulte o <code>.env.example</code> e o README para configurar banco de dados e autenticação.</p>
      </div>
    </div>
  );
}

function Brand() {
  return <div className="brand auth-brand"><span className="brand-mark"><BadgeDollarSign size={23} /></span><span>fluxo<span className="brand-dot">.</span></span></div>;
}

function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function changeMode(next) {
    setMode(next);
    setError("");
    setMessage("");
  }

  async function submitEmail(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Informe um endereço de e-mail válido.");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (mode !== "forgot" && password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      } else if (mode === "register") {
        const { data: result, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        if (!result.session) setMessage("Cadastro iniciado! Confirme seu e-mail pelo link que enviamos.");
      } else {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        });
        if (authError) throw authError;
        setMessage("Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.");
      }
    } catch (authError) {
      setError(formatError(authError));
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "register" ? "Crie sua conta" : mode === "forgot" ? "Recupere o acesso" : "Bem-vindo de volta";
  return (
    <div className="auth-page">
      <div className="auth-wrap">
        <Brand />
        <div className="auth-card">
          <span className="auth-eyebrow">{mode === "forgot" ? "RECUPERAÇÃO DE ACESSO" : "SUAS FINANÇAS, EM EQUILÍBRIO"}</span>
          <h1>{title}</h1>
          <p className="auth-subtitle">
            {mode === "register" ? "Comece a organizar seu dinheiro hoje." : mode === "forgot" ? "Vamos enviar um link seguro para o seu e-mail." : "Entre para acompanhar seu dinheiro com clareza."}
          </p>
          <form onSubmit={submitEmail} className="form-stack">
            <label>E-mail
              <input autoComplete="email" type="email" placeholder="voce@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            {mode !== "forgot" && (
              <>
                <label>Senha
                  <span className="password-wrap">
                    <input autoComplete={mode === "register" ? "new-password" : "current-password"} type={showPassword ? "text" : "password"} placeholder="Mínimo de 6 caracteres" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
                    <button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                  </span>
                </label>
                {mode === "register" && (
                  <label>Confirmar senha
                    <input autoComplete="new-password" type={showPassword ? "text" : "password"} placeholder="Digite a senha novamente" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} />
                  </label>
                )}
              </>
            )}
            {mode === "login" && <button type="button" className="text-link forgot-link" onClick={() => changeMode("forgot")}>Esqueci minha senha</button>}
            {error && <div className="form-alert error-alert" role="alert">{error}</div>}
            {message && <div className="form-alert success-alert" role="status">{message}</div>}
            <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle size={17} className="spin" /> : null}{mode === "register" ? "Criar conta" : mode === "forgot" ? "Enviar link de redefinição" : "Entrar"}</button>
          </form>

          <div className="auth-switch">
            {mode === "forgot" ? (
              <button className="text-link" onClick={() => changeMode("login")}>Voltar para o login</button>
            ) : mode === "register" ? (
              <>Já tem uma conta? <button className="text-link" onClick={() => changeMode("login")}>Entrar</button></>
            ) : (
              <>Ainda não tem uma conta? <button className="text-link" onClick={() => changeMode("register")}>Cadastre-se</button></>
            )}
          </div>
        </div>
        <p className="auth-footnote"><ShieldCheck size={14} /> Seus dados são protegidos com segurança em todas as etapas.</p>
      </div>
    </div>
  );
}

function Dashboard({ data, onNavigate, onAdd, onExport }) {
  const now = new Date();
  const thisMonth = data.transactions.filter((item) => {
    const date = new Date(`${item.occurred_on}T00:00:00`);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  });
  const income = thisMonth.filter((item) => item.kind === "income").reduce((sum, item) => sum + Number(item.amount), 0);
  const expenses = thisMonth.filter((item) => item.kind === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
  const totalBalance = data.accounts.reduce((sum, account) => sum + accountBalance(account, data.transactions), 0);
  const expenseByCategory = thisMonth.filter((item) => item.kind === "expense").reduce((result, item) => {
    const label = item.categories?.name || "Sem categoria";
    result[label] = (result[label] || 0) + Number(item.amount);
    return result;
  }, {});
  const pieData = Object.entries(expenseByCategory).map(([name, value]) => ({
    name,
    value,
    color: data.categories.find((category) => category.name === name)?.color || "#adb8b2",
  })).sort((a, b) => b.value - a.value);
  const trend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const transactions = data.transactions.filter((item) => {
      const itemDate = new Date(`${item.occurred_on}T00:00:00`);
      return itemDate.getMonth() === month && itemDate.getFullYear() === year;
    });
    return {
      month: monthNames[month],
      Receitas: transactions.filter((item) => item.kind === "income").reduce((sum, item) => sum + Number(item.amount), 0),
      Despesas: transactions.filter((item) => item.kind === "expense").reduce((sum, item) => sum + Number(item.amount), 0),
    };
  });
  const recent = data.transactions.slice(0, 5);

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">SEU DINHEIRO, MAIS CLARO</span><h1>Visão geral</h1><p>Acompanhe sua vida financeira em um só lugar.</p></div>
        <div className="heading-actions">
          <button className="secondary-button export-button" onClick={onExport}><Download size={16} /> Exportar</button>
          <button className="primary-button" onClick={onAdd}><Plus size={17} /> Nova transação</button>
        </div>
      </div>
      <div className="stat-grid">
        <StatCard label="Saldo total" value={currency(totalBalance)} icon={Wallet} detail={`${data.accounts.length} ${data.accounts.length === 1 ? "conta cadastrada" : "contas cadastradas"}`} accent="green" />
        <StatCard label="Receitas do mês" value={currency(income)} icon={TrendingUp} detail="Entradas neste mês" accent="mint" />
        <StatCard label="Despesas do mês" value={currency(expenses)} icon={TrendingDown} detail="Saídas neste mês" accent="peach" />
        <StatCard label="Economia do mês" value={currency(income - expenses)} icon={BadgeDollarSign} detail={income - expenses >= 0 ? "Você está no positivo" : "Despesas acima das receitas"} accent="lavender" />
      </div>
      <div className="dashboard-grid">
        <section className="panel trend-panel">
          <div className="panel-heading"><div><h2>Fluxo financeiro</h2><p>Receitas e despesas nos últimos 6 meses</p></div><span className="period-pill">6 meses <ChevronDown size={14} /></span></div>
          {data.transactions.length === 0 ? <EmptyChart onClick={onAdd} /> : (
            <div className="chart-wrap">
              <TrendBars data={trend} />
            </div>
          )}
        </section>
        <section className="panel category-panel">
          <div className="panel-heading"><div><h2>Despesas por categoria</h2><p>Distribuição deste mês</p></div><button className="icon-button panel-more" onClick={() => onNavigate("categories")} aria-label="Ver categorias">•••</button></div>
          {pieData.length === 0 ? <div className="empty-mini"><span className="empty-icon"><Tags size={20} /></span><strong>Sem despesas por aqui</strong><p>Suas categorias aparecem aqui conforme você registra despesas.</p></div> : (
            <>
              <div className="donut-wrap">
                <div className="donut-visual" role="img" aria-label={`Despesas por categoria: ${pieData.map((item) => `${item.name}, ${currency(item.value)}`).join("; ")}`} style={{ background: pieGradient(pieData) }} />
                <div className="donut-center"><small>Total gasto</small><strong>{currency(expenses)}</strong></div>
              </div>
              <div className="category-legend">{pieData.slice(0, 4).map((item) => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{currency(item.value)}</strong></div>)}</div>
            </>
          )}
        </section>
      </div>
      <div className="dashboard-grid lower-grid">
        <section className="panel transactions-panel">
          <div className="panel-heading"><div><h2>Transações recentes</h2><p>Suas últimas movimentações</p></div><button className="text-link" onClick={() => onNavigate("transactions")}>Ver todas <ArrowUpRight size={14} /></button></div>
          {recent.length === 0 ? <EmptyTransactions onClick={onAdd} /> : <TransactionTable transactions={recent} compact />}
        </section>
        <section className="panel accounts-panel">
          <div className="panel-heading"><div><h2>Minhas contas</h2><p>Saldo disponível por conta</p></div><button className="icon-button panel-more" onClick={() => onNavigate("accounts")} aria-label="Ver contas"><ArrowUpRight size={17} /></button></div>
          {data.accounts.length === 0 ? <div className="empty-mini"><span className="empty-icon"><CreditCard size={20} /></span><strong>Cadastre sua primeira conta</strong><p>Adicione uma conta ou carteira para começar.</p><button className="text-link" onClick={() => onNavigate("accounts")}>Adicionar conta <Plus size={14} /></button></div> : (
            <div className="account-list">{data.accounts.slice(0, 4).map((account) => <AccountRow account={account} balance={accountBalance(account, data.transactions)} key={account.id} />)}</div>
          )}
        </section>
      </div>
      <BudgetAlerts data={data} onNavigate={onNavigate} />
    </>
  );
}

function TrendBars({ data }) {
  const maximum = Math.max(0, ...data.flatMap((item) => [item.Receitas, item.Despesas]));
  const roughStep = Math.max(maximum / 4, 1);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = Math.ceil(roughStep / magnitude) * magnitude;
  const scaleMax = step * 4;
  const chartTop = 13;
  const chartHeight = 166;
  const baseY = chartTop + chartHeight;
  const startX = 52;
  const slot = 91;
  const barWidth = 19;
  const compact = (value) => value >= 1000 ? `${(value / 1000).toFixed(value % 1000 ? 1 : 0)}k` : String(value);

  return <div className="trend-chart">
    <svg viewBox="0 0 640 218" role="img" aria-label="Gráfico de receitas e despesas nos últimos seis meses">
      {Array.from({ length: 5 }, (_, index) => {
        const value = step * (4 - index);
        const y = chartTop + (chartHeight / 4) * index;
        return <g key={index}>
          <line x1="42" x2="625" y1={y} y2={y} stroke="#edf0ee" strokeWidth="1" />
          <text x="35" y={y + 3} textAnchor="end" fill="#98a29d" fontSize="10">{compact(value)}</text>
        </g>;
      })}
      {data.map((item, index) => {
        const groupX = startX + index * slot;
        const incomeHeight = (item.Receitas / scaleMax) * chartHeight;
        const expenseHeight = (item.Despesas / scaleMax) * chartHeight;
        return <g key={item.month}>
          <rect x={groupX + 8} y={baseY - incomeHeight} width={barWidth} height={incomeHeight} rx="4" fill="#58a88d">
            <title>{`${item.month} — Receitas: ${currency(item.Receitas)}`}</title>
          </rect>
          <rect x={groupX + 33} y={baseY - expenseHeight} width={barWidth} height={expenseHeight} rx="4" fill="#f1a47d">
            <title>{`${item.month} — Despesas: ${currency(item.Despesas)}`}</title>
          </rect>
          <text x={groupX + 30} y="203" textAnchor="middle" fill="#98a29d" fontSize="11">{item.month}</text>
        </g>;
      })}
    </svg>
    <div className="chart-legend"><span><i />Receitas</span><span><i />Despesas</span></div>
  </div>;
}

function pieGradient(items) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let position = 0;
  const slices = items.map((item) => {
    const end = position + (item.value / total) * 100;
    const slice = `${item.color} ${position}% ${end}%`;
    position = end;
    return slice;
  });
  return `conic-gradient(${slices.join(", ")})`;
}

function StatCard({ label, value, icon: Icon, detail, accent }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${accent}`}><Icon size={18} /></span></div><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></div>;
}

function EmptyChart({ onClick }) {
  return <div className="empty-chart"><span className="empty-icon"><TrendingUp size={22} /></span><strong>Seu resumo começa aqui</strong><p>Adicione uma transação para acompanhar suas receitas e despesas.</p><button className="text-link" onClick={onClick}>Adicionar transação <Plus size={14} /></button></div>;
}

function EmptyTransactions({ onClick }) {
  return <div className="empty-table"><FileText size={22} /><span>Nenhuma transação registrada ainda.</span><button className="text-link" onClick={onClick}>Adicionar a primeira</button></div>;
}

function accountBalance(account, transactions) {
  return Number(account.opening_balance) + transactions
    .filter((item) => item.account_id === account.id)
    .reduce((balance, item) => balance + (item.kind === "income" ? 1 : -1) * Number(item.amount), 0);
}

function AccountRow({ account, balance }) {
  return <div className="account-row"><span className="account-symbol" style={{ background: `${account.color}20`, color: account.color }}><Wallet size={17} /></span><span className="account-description"><strong>{account.name}</strong><small>{accountType(account.type)}</small></span><strong className="account-balance">{currency(balance)}</strong></div>;
}

function accountType(type) {
  return ACCOUNT_TYPES.find(([value]) => value === type)?.[1] ?? type;
}

function TransactionTable({ transactions, compact = false, onDelete }) {
  return (
    <div className="table-scroll"><table className="transaction-table">
      <thead><tr><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Data</th><th className="align-right">Valor</th>{onDelete && <th />}</tr></thead>
      <tbody>{transactions.map((item) => {
        const income = item.kind === "income";
        return <tr key={item.id}>
          <td><div className="transaction-description"><span className={`transaction-kind-icon ${income ? "income" : "expense"}`}>{income ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><span><strong>{item.description}</strong><small>{income ? "Receita" : "Despesa"}</small></span></div></td>
          <td><span className="table-category"><i style={{ background: item.categories?.color || "#adb8b2" }} />{item.categories?.name || "Sem categoria"}</span></td>
          <td className="muted-cell">{item.accounts?.name || "—"}</td>
          <td className="muted-cell">{dateLabel.format(new Date(`${item.occurred_on}T00:00:00`))}</td>
          <td className={`align-right transaction-amount ${income ? "amount-income" : ""}`}>{income ? "+" : "−"}{currency(item.amount)}</td>
          {onDelete && <td><button className="icon-button delete-button" aria-label={`Excluir ${item.description}`} title="Excluir transação" onClick={() => onDelete(item.id)}><X size={15} /></button></td>}
        </tr>;
      })}</tbody>
      {!transactions.length && <tfoot><tr><td colSpan={onDelete ? 6 : 5} className="empty-table-cell">Nenhuma transação encontrada com estes filtros.</td></tr></tfoot>}
    </table></div>
  );
}

function TransactionsPage({ data, onAdd, onDelete, onExport }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [month, setMonth] = useState("");
  const filtered = useMemo(() => data.transactions.filter((item) => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    const matchesQuery = !normalizedQuery || [item.description, item.categories?.name, item.accounts?.name].filter(Boolean).some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
    return matchesQuery && (kind === "all" || item.kind === kind) && (!month || item.occurred_on.startsWith(month));
  }), [data.transactions, query, kind, month]);
  return <>
    <div className="page-heading"><div><span className="eyebrow">ACOMPANHE CADA MOVIMENTO</span><h1>Transações</h1><p>Consulte, filtre e organize suas movimentações.</p></div><div className="heading-actions"><button className="secondary-button export-button" onClick={() => onExport(filtered)}><Download size={16} /> Exportar CSV</button><button className="primary-button" onClick={onAdd}><Plus size={17} /> Nova transação</button></div></div>
    <section className="panel transactions-full-panel">
      <div className="filters-row">
        <label className="search-field"><Search size={17} /><input placeholder="Buscar por descrição, categoria ou conta..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <select aria-label="Filtrar por tipo" value={kind} onChange={(event) => setKind(event.target.value)}><option value="all">Todos os tipos</option><option value="income">Receitas</option><option value="expense">Despesas</option></select>
        <input aria-label="Filtrar por mês" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </div>
      <TransactionTable transactions={filtered} onDelete={onDelete} />
      <div className="table-footer">{filtered.length} {filtered.length === 1 ? "transação" : "transações"} {filtered.length !== data.transactions.length && `de ${data.transactions.length}`}</div>
    </section>
  </>;
}

function AccountsPage({ data, onAdd, onNavigate }) {
  const total = data.accounts.reduce((sum, account) => sum + accountBalance(account, data.transactions), 0);
  return <>
    <div className="page-heading"><div><span className="eyebrow">CONTAS E CARTEIRAS</span><h1>Minhas contas</h1><p>Veja onde está seu dinheiro e acompanhe cada saldo.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17} /> Adicionar conta</button></div>
    <div className="accounts-summary"><span className="account-summary-icon"><Wallet size={22} /></span><div><span>Saldo consolidado</span><strong>{currency(total)}</strong><small>Distribuído em {data.accounts.length} {data.accounts.length === 1 ? "conta" : "contas"}</small></div></div>
    {!data.accounts.length ? <section className="panel page-empty"><span className="empty-icon"><CreditCard size={23} /></span><h2>Nenhuma conta cadastrada</h2><p>Adicione sua conta bancária, poupança ou carteira para começar a controlar seus saldos.</p><button className="primary-button" onClick={onAdd}><Plus size={17} /> Criar primeira conta</button></section> : (
      <div className="account-cards">{data.accounts.map((account) => <article className="account-card" key={account.id}><div className="account-card-top"><span className="account-symbol large" style={{ background: `${account.color}20`, color: account.color }}><Wallet size={20} /></span><span className="account-type-pill">{accountType(account.type)}</span></div><h2>{account.name}</h2><p>Saldo atual</p><strong className="account-card-balance">{currency(accountBalance(account, data.transactions))}</strong><div className="account-card-bottom"><span>Saldo inicial</span><strong>{currency(account.opening_balance)}</strong><button className="text-link" onClick={() => onNavigate("transactions")}>Ver movimentações <ArrowUpRight size={14} /></button></div></article>)}</div>
    )}
  </>;
}

function budgetUsage(budget, transactions) {
  const spent = transactions.filter((item) => item.kind === "expense" && item.category_id === budget.category_id && item.occurred_on.startsWith(`${budget.year}-${String(budget.month).padStart(2, "0")}`)).reduce((sum, item) => sum + Number(item.amount), 0);
  return Number(budget.amount) ? (spent / Number(budget.amount)) * 100 : 0;
}

function BudgetsPage({ data, onAdd }) {
  const [period, setPeriod] = useState(dateInputValue().slice(0, 7));
  const [year, month] = period.split("-").map(Number);
  const monthBudgets = data.budgets.filter((budget) => budget.year === year && budget.month === month);
  return <>
    <div className="page-heading"><div><span className="eyebrow">PLANEJE COM TRANQUILIDADE</span><h1>Orçamentos</h1><p>Defina limites mensais e mantenha seus objetivos no caminho.</p></div><div className="heading-actions"><input className="budget-month-picker" type="month" aria-label="Mês dos orçamentos" value={period} onChange={(event) => setPeriod(event.target.value)} /><button className="primary-button" onClick={onAdd}><Plus size={17} /> Criar orçamento</button></div></div>
    <div className="budget-period-label">{monthNames[month - 1]} {year} <span>· Orçamentos deste mês</span></div>
    {!monthBudgets.length ? <section className="panel page-empty"><span className="empty-icon"><Target size={23} /></span><h2>Um plano para cada categoria</h2><p>Crie seu primeiro orçamento e acompanhe seus gastos mensais sem surpresas.</p><button className="primary-button" onClick={onAdd}><Plus size={17} /> Criar orçamento</button></section> : (
      <div className="budget-grid">{monthBudgets.map((budget) => {
        const spent = data.transactions.filter((item) => item.kind === "expense" && item.category_id === budget.category_id && item.occurred_on.startsWith(`${budget.year}-${String(budget.month).padStart(2, "0")}`)).reduce((sum, item) => sum + Number(item.amount), 0);
        const percentage = Math.min((spent / Number(budget.amount)) * 100, 100);
        const warning = percentage >= Number(budget.alert_threshold);
        return <article className={`budget-card ${warning ? "budget-warning" : ""}`} key={budget.id}>
          <div className="budget-card-heading"><span className="budget-category-icon" style={{ background: `${budget.categories?.color || "#58a88d"}20`, color: budget.categories?.color || "#58a88d" }}>{budget.categories?.icon || "◉"}</span><span><strong>{budget.categories?.name || "Categoria"}</strong><small>Limite mensal</small></span><span className={`budget-status ${warning ? "warning" : ""}`}>{warning ? <><Bell size={13} /> Próximo do limite</> : "Dentro do limite"}</span></div>
          <div className="budget-numbers"><span><strong>{currency(spent)}</strong> gastos</span><span>de <strong>{currency(budget.amount)}</strong></span></div>
          <div className="progress-track"><span style={{ width: `${percentage}%`, background: warning ? "#e4865a" : budget.categories?.color || "#58a88d" }} /></div>
          <div className="budget-card-footer"><span>{Math.round(spent / Number(budget.amount) * 100)}% utilizado</span><span>{currency(Math.max(Number(budget.amount) - spent, 0))} restantes</span></div>
          <p className="budget-alert-note">Alerta configurado para {budget.alert_threshold}% do limite.</p>
        </article>;
      })}</div>
    )}
  </>;
}

function CategoriesPage({ data, onAdd }) {
  const grouped = { expense: data.categories.filter((category) => category.kind === "expense"), income: data.categories.filter((category) => category.kind === "income") };
  return <>
    <div className="page-heading"><div><span className="eyebrow">DO SEU JEITO</span><h1>Categorias</h1><p>Organize receitas e despesas com categorias personalizadas.</p></div><button className="primary-button" onClick={onAdd}><Plus size={17} /> Nova categoria</button></div>
    {!data.categories.length ? <section className="panel page-empty"><span className="empty-icon"><Tags size={23} /></span><h2>Suas categorias aparecem aqui</h2><p>As categorias padrão são criadas automaticamente quando você entra pela primeira vez.</p></section> : (
      <div className="category-groups">{[["expense", "Despesas", TrendingDown], ["income", "Receitas", TrendingUp]].map(([kind, title, Icon]) => <section className="panel category-group" key={kind}><div className="panel-heading"><div><h2><Icon size={17} /> {title}</h2><p>{grouped[kind].length} {grouped[kind].length === 1 ? "categoria" : "categorias"}</p></div></div><div className="category-chips">{grouped[kind].map((category) => <div className="category-chip" key={category.id}><span style={{ background: `${category.color}20`, color: category.color }}>{category.icon}</span><strong>{category.name}</strong></div>)}</div></section>)}</div>
    )}
  </>;
}

function BudgetAlerts({ data, onNavigate }) {
  const activeBudgets = data.budgets.filter((budget) => budget.year === new Date().getFullYear() && budget.month === new Date().getMonth() + 1);
  const alerts = activeBudgets.filter((budget) => budgetUsage(budget, data.transactions) >= Number(budget.alert_threshold));
  if (!alerts.length) return null;
  return <button className="budget-alert-banner" onClick={() => onNavigate("budgets")}><span className="alert-bell"><Bell size={17} /></span><span><strong>Fique de olho no seu orçamento</strong><small>{alerts.map((budget) => budget.categories?.name).filter(Boolean).join(", ")} {alerts.length === 1 ? "está" : "estão"} se aproximando do limite.</small></span><ArrowUpRight size={17} /></button>;
}

function HelpPage() {
  return <div className="page-heading"><div><span className="eyebrow">ESTAMOS AQUI PARA AJUDAR</span><h1>Ajuda e suporte</h1><p>Algumas dicas rápidas para usar seu espaço financeiro.</p></div><div className="help-grid">
    <section className="panel help-card"><span className="help-number">01</span><h2>Cadastre suas contas</h2><p>Adicione bancos, carteiras ou cartões com seu saldo inicial para ter uma visão consolidada.</p></section>
    <section className="panel help-card"><span className="help-number">02</span><h2>Registre cada movimento</h2><p>Inclua receitas e despesas com categoria, conta e data para acompanhar seu fluxo.</p></section>
    <section className="panel help-card"><span className="help-number">03</span><h2>Planeje seus limites</h2><p>Defina orçamentos por categoria e receba um alerta visual ao se aproximar do limite.</p></section>
    <section className="panel help-card"><span className="help-number">04</span><h2>Exporte seus dados</h2><p>Baixe suas transações em CSV pela tela de transações para analisar em uma planilha.</p></section>
  </div></div>;
}

function FinanceModal({ type, data, userId, onClose, onSave }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState("expense");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState(data.accounts[0]?.id || "");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#58a88d");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(dateInputValue());
  const [accountTypeValue, setAccountTypeValue] = useState("checking");
  const [threshold, setThreshold] = useState("80");
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  const title = { transaction: "Nova transação", account: "Adicionar conta", category: "Nova categoria", budget: "Criar orçamento" }[type];
  const categories = data.categories.filter((category) => category.kind === kind);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      let table;
      let payload;
      let success;
      if (type === "transaction") {
        if (!data.accounts.length) throw new Error("Cadastre uma conta antes de adicionar transações.");
        if (!accountId) throw new Error("Selecione uma conta.");
        payload = {
          user_id: userId,
          account_id: accountId,
          category_id: categoryId || null,
          kind,
          amount: Number(amount),
          description: description.trim(),
          occurred_on: date,
        };
        table = "transactions";
        success = "Transação adicionada.";
      } else if (type === "account") {
        payload = { user_id: userId, name: name.trim(), type: accountTypeValue, opening_balance: Number(amount || 0), color };
        table = "accounts";
        success = "Conta adicionada.";
      } else if (type === "category") {
        payload = { user_id: userId, name: name.trim(), kind, color };
        table = "categories";
        success = "Categoria adicionada.";
      } else {
        const [year, month] = period.split("-").map(Number);
        if (!categoryId) throw new Error("Selecione uma categoria.");
        payload = { user_id: userId, category_id: categoryId, year, month, amount: Number(amount), alert_threshold: Number(threshold) };
        table = "budgets";
        success = "Orçamento salvo.";
      }
      await onSave(table, payload, success);
    } catch (saveError) {
      setError(formatError(saveError));
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-heading"><div><span className="eyebrow">SEU ESPAÇO FINANCEIRO</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button></div>
      <form className="form-stack modal-form" onSubmit={submit}>
        {type === "transaction" && <>
          <div className="segmented-control"><button type="button" className={kind === "expense" ? "selected" : ""} onClick={() => { setKind("expense"); setCategoryId(""); }}>Despesa</button><button type="button" className={kind === "income" ? "selected income-selected" : ""} onClick={() => { setKind("income"); setCategoryId(""); }}>Receita</button></div>
          {!data.accounts.length && <div className="form-alert error-alert">Você precisa cadastrar uma conta antes de lançar transações.</div>}
          <label>Descrição<input autoFocus placeholder="Ex.: Conta de energia" value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={160} /></label>
          <label>Valor (R$)<input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
          <div className="form-two-col"><label>Categoria<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Sem categoria</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label>Conta<select value={accountId} onChange={(event) => setAccountId(event.target.value)} required><option value="">Selecione</option>{data.accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label></div>
          <label>Data<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        </>}
        {type === "account" && <>
          <label>Nome da conta<input autoFocus placeholder="Ex.: Conta principal" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></label>
          <label>Tipo<select value={accountTypeValue} onChange={(event) => setAccountTypeValue(event.target.value)}>{ACCOUNT_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Saldo inicial (R$)<input type="number" step="0.01" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <label>Cor da conta<span className="color-input-wrap"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><span>Escolha uma cor para identificar esta conta.</span></span></label>
        </>}
        {type === "category" && <>
          <div className="segmented-control"><button type="button" className={kind === "expense" ? "selected" : ""} onClick={() => setKind("expense")}>Despesa</button><button type="button" className={kind === "income" ? "selected income-selected" : ""} onClick={() => setKind("income")}>Receita</button></div>
          <label>Nome da categoria<input autoFocus placeholder="Ex.: Educação" value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} /></label>
          <label>Cor<span className="color-input-wrap"><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><span>Escolha uma cor para identificar esta categoria.</span></span></label>
        </>}
        {type === "budget" && <>
          <label>Categoria de despesa<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required><option value="">Selecione uma categoria</option>{data.categories.filter((category) => category.kind === "expense").map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
          <label>Limite mensal (R$)<input autoFocus type="number" min="0.01" step="0.01" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
          <label>Mês do orçamento<input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} required /></label>
          <label>Alertar quando atingir (%)<input type="number" min="1" max="100" value={threshold} onChange={(event) => setThreshold(event.target.value)} required /><small className="field-hint">Você verá um aviso ao atingir este percentual do orçamento.</small></label>
        </>}
        {error && <div className="form-alert error-alert" role="alert">{error}</div>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy || (type === "transaction" && !data.accounts.length)}>{busy && <LoaderCircle size={16} className="spin" />}{type === "budget" ? "Salvar orçamento" : type === "account" ? "Adicionar conta" : type === "category" ? "Criar categoria" : "Salvar transação"}</button></div>
      </form>
    </div>
  </div>;
}
