# 安裝與環境設定指南

本文件說明如何在本機執行 AI 旅遊行程規劃師，以及各 API 金鑰的申請方式。

---

## 系統需求

- **Node.js** 18 以上
- **npm** 9 以上（或 yarn / pnpm）
- 現代瀏覽器（Chrome / Firefox / Safari / Edge）

---

## 快速開始

```bash
# 1. Clone 專案
git clone https://github.com/Yan-Weichen/weather-trip-planner.git
cd weather-trip-planner

# 2. 安裝相依套件
npm install

# 3. 建立環境變數檔案
cp .env.example .env.local

# 4. 啟動開發伺服器
npm run dev
```

開啟瀏覽器前往 `http://localhost:5173`。

> **注意**：不設定任何 API 金鑰也可以執行，系統會自動使用靜態 fallback 模式（無 AI、無地圖景點資訊）。

---

## 環境變數設定

編輯 `.env.local`，依需要填入以下金鑰：

```env
VITE_GEMINI_API_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_PLACES_API_KEY=
```

---

## API 金鑰申請

### 1. Google Gemini API（AI 行程生成）

1. 前往 [Google AI Studio](https://aistudio.google.com/)
2. 登入 Google 帳號
3. 點選左側 **Get API key** → **Create API key**
4. 複製金鑰，填入 `VITE_GEMINI_API_KEY`

> 本專案使用 `gemini-2.0-flash`，失敗時自動改用 `gemini-2.5-flash`。免費額度依 Google 當期公告為準，開發用途通常足夠。

---

### 2. Google Places API（景點照片 / 評分）

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案（或選擇現有專案）
3. 左側選單 → **API 和服務** → **啟用 API 和服務**
4. 搜尋並啟用 **Places API (New)**
5. 左側選單 → **憑證** → **建立憑證** → **API 金鑰**
6. 複製金鑰，填入 `VITE_GOOGLE_PLACES_API_KEY`

> 建議在 **API 金鑰限制** 中設定「HTTP 參照網址」限制，僅允許你的網域（localhost 與 Vercel 網址），避免金鑰濫用。

> 費用：新帳號有 $300 美元免費抵免額度（90 天）。Places Text Search 每次約 $0.032，每次行程規劃約消耗 $0.5。

---

### 3. Supabase（帳號登入 + 雲端儲存）

#### 建立專案

1. 前往 [supabase.com](https://supabase.com/) 並註冊
2. 點選 **New project**，輸入專案名稱與資料庫密碼
3. 等待專案初始化（約 1 分鐘）

#### 取得金鑰

1. 左側選單 → **Project Settings** → **API**
2. 複製 **Project URL** → 填入 `VITE_SUPABASE_URL`
3. 複製 **anon public** key → 填入 `VITE_SUPABASE_ANON_KEY`

#### 建立資料庫資料表

在 Supabase 的 **SQL Editor** 中執行以下 SQL：

```sql
create table trips (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  plan_data jsonb not null,
  share_id text unique,
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 啟用 Row Level Security
alter table trips enable row level security;

-- 使用者只能讀寫自己的行程
create policy "Users can manage own trips"
  on trips for all
  using (auth.uid() = user_id);

-- 公開分享的行程任何人可讀
create policy "Public trips are readable"
  on trips for select
  using (is_public = true);
```

#### 設定 Auth 允許的網址（Vercel 部署後需做）

1. 左側選單 → **Authentication** → **URL Configuration**
2. **Site URL** 填入：`https://your-project.vercel.app`
3. **Redirect URLs** 新增：`https://your-project.vercel.app/**`

---

## （選用）部署到 Vercel

> 本專案目前以本機執行為主，未維護對外站台。以下步驟供想自行部署的人參考。

### 方法一：連接 GitHub（推薦）

1. 將專案 push 到 GitHub
2. 前往 [vercel.com](https://vercel.com/) 並登入
3. 點選 **Add New Project** → 選擇你的 GitHub repo
4. 在 **Environment Variables** 填入所有 `.env.local` 的金鑰
5. 點選 **Deploy**

之後每次 `git push origin main` 都會自動觸發重新部署。

### 方法二：Vercel CLI

```bash
npm i -g vercel
vercel --prod
```

---

## 常用指令

```bash
npm run dev        # 啟動開發伺服器（localhost:5173）
npm run build      # 建構生產版本
npm run preview    # 本機預覽生產版本
npx tsc --noEmit   # TypeScript 型別檢查
```

---

## 常見問題

**Q：沒有 Gemini API 金鑰可以執行嗎？**
A：可以。系統偵測到沒有金鑰時，會自動切換到內建的靜態行程生成器，功能受限但可以跑起來。

**Q：Places API 的景點照片沒有出現？**
A：確認 `VITE_GOOGLE_PLACES_API_KEY` 已設定，且 Google Cloud Console 中已啟用 **Places API (New)**（注意不是舊版 Places API）。

**Q：Vercel 部署後分享連結 `/share/xxx` 回傳 404？**
A：確認專案根目錄有 `vercel.json`，內容如下：
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Q：登入後雲端行程無法讀取？**
A：確認 Supabase 的 **URL Configuration** 已加入 Vercel 網址，且資料庫已建立 `trips` 資料表與 RLS Policy。
