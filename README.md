# Fluxo — controle financeiro pessoal

Aplicação web responsiva para organizar contas, receitas, despesas e orçamentos. O frontend usa React + Vite; autenticação, persistência e autorização são fornecidas pelo Supabase. Todo acesso aos dados financeiros é protegido por Row Level Security (RLS).

## Funcionalidades

- Cadastro, login e recuperação de senha por e-mail.
- Rotas internas protegidas por sessão Supabase.
- Contas bancárias, poupanças, carteiras e cartões com saldo inicial e saldo calculado.
- Receitas e despesas com categorias, conta e data.
- Dashboard mensal, gráficos de fluxo e despesas por categoria.
- Busca e filtros de transações; remoção de transação.
- Categorias personalizadas e orçamentos mensais por categoria com alerta configurável.
- Exportação de transações filtradas ou completas em CSV.

## Requisitos

- Node.js 20 ou superior e npm.
- Projeto Supabase.

## Executar localmente

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie um projeto no [Supabase](https://supabase.com/dashboard) e abra **Project Settings → API**.
3. Copie `.env.example` para `.env` e preencha as credenciais públicas do projeto:

   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-publica-anon
   ```

   A chave `anon`/publishable é destinada ao navegador e não substitui as políticas RLS. **Nunca** inclua `service_role`, secrets ou chaves privadas no frontend, no GitHub ou em variáveis `VITE_*`.

4. No Supabase, abra **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql) e execute. Isso cria as tabelas, índices, chaves estrangeiras, gatilhos e políticas RLS.
5. Inicie o servidor local:

   ```bash
   npm run dev
   ```

   Abra a URL indicada pelo Vite, normalmente `http://localhost:5173`.

Para validar a versão de produção localmente:

```bash
npm run build
npm run preview
```

## Configuração da autenticação Supabase

Em **Authentication → URL Configuration**:

- Defina **Site URL** para `http://localhost:5173` durante o desenvolvimento.
- Inclua em **Redirect URLs** `http://localhost:5173/**` e, após publicar, `https://SEU-DOMINIO-VERCEL.vercel.app/**` (além do domínio próprio, se houver).
- O fluxo de recuperação usa a origem do site para retornar ao formulário de nova senha; essa origem também precisa estar permitida.

O acesso da aplicação usa e-mail e senha, com confirmação de e-mail opcional. Se a confirmação estiver habilitada, o usuário deverá abrir o link enviado antes de entrar. Configure os modelos de e-mail do Supabase para direcionarem à URL do app.

## Banco de dados e segurança

O arquivo [`supabase/schema.sql`](./supabase/schema.sql) cria:

- `accounts`: contas e saldo inicial.
- `categories`: categorias de receita ou despesa por usuário.
- `transactions`: movimentações vinculadas à conta e, opcionalmente, à categoria.
- `budgets`: limite mensal e percentual de alerta por categoria.

Todas as tabelas têm `user_id` vinculado a `auth.users`, RLS habilitado e políticas de leitura/escrita que comparam `user_id` com `auth.uid()`. Chaves estrangeiras compostas também impedem vincular a transação ou orçamento à conta/categoria de outro usuário. A aplicação usa somente a chave pública Supabase; o SDK envia a sessão autenticada e o banco aplica as políticas em cada requisição. Não há Edge Function necessária para essas operações CRUD: não existe operação privilegiada que justifique expor ou usar uma chave de serviço.

## Publicar no GitHub e fazer deploy na Vercel

### 1. Criar e enviar o repositório ao GitHub

1. Crie um repositório vazio em [github.com/new](https://github.com/new). Não adicione README, licença ou `.gitignore` pelo GitHub, pois estes arquivos já existem localmente.
2. No terminal, na pasta do projeto, inicialize o Git e confira os arquivos:

   ```bash
   git init
   git add .
   git status
   ```

   Confirme que `.env` **não** aparece entre os arquivos preparados. O `.gitignore` exclui esse arquivo; mantenha os valores reais somente localmente e no painel da Vercel.
3. Crie o primeiro commit e vincule o repositório criado:

   ```bash
   git commit -m "Initial commit: Fluxo financeiro"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
   git push -u origin main
   ```

   Se o Git informar que o repositório já foi inicializado, não repita `git init`; confira `git status` e use o remote correspondente ao repositório criado.

### 2. Importar o projeto na Vercel

1. Entre em [vercel.com](https://vercel.com) com sua conta e escolha **Add New → Project**.
2. Conecte o GitHub, autorize o acesso ao repositório e selecione o projeto.
3. A Vercel detecta Vite. Confirme:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Antes de publicar, em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL` — URL do projeto Supabase.
   - `VITE_SUPABASE_ANON_KEY` — chave pública anon/publishable.
   
   Aplique as variáveis aos ambientes desejados (Production, Preview e Development) e selecione **Deploy**. Variáveis Vite são incorporadas ao bundle do navegador; portanto, use somente valores públicos e mantenha RLS ativa.
5. Após o deploy, abra o domínio `*.vercel.app` atribuído ao projeto e teste cadastro, login, reset de senha e uma transação. Para mudanças nas variáveis, faça novo deploy para que o bundle seja reconstruído.

### 3. Atualizar os redirecionamentos no Supabase

1. Copie o domínio de produção atribuído pela Vercel.
2. Em **Supabase → Authentication → URL Configuration**, altere **Site URL** para `https://SEU-PROJETO.vercel.app`.
3. Em **Redirect URLs**, inclua:

   ```text
   http://localhost:5173/**
   https://SEU-PROJETO.vercel.app/**
   https://*-SEU-ESCOPO.vercel.app/**
   ```

   A última entrada é opcional e permite URLs de Preview da Vercel. Prefira restringir o padrão ao seu escopo; não habilite curingas amplos em produção.
4. Os links de confirmação e recuperação de senha retornam ao domínio configurado e permitido.

## Scripts

- `npm run dev` — desenvolvimento local.
- `npm run build` — build otimizado em `dist/`.
- `npm run preview` — serve o build localmente para verificação.
