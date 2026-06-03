# AI 旅遊行程規劃師

![Vercel](https://img.shields.io/badge/Vercel-deployed-black?logo=vercel)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)

根據**即時天氣預報**，透過 **Google Gemini AI** 智慧規劃個人化旅遊行程，整合互動地圖、景點評分、雲端儲存與分享連結。

🌐 **線上展示**：https://weather-trip-planner-ten.vercel.app/

---

## 目錄

1. [系統概述](#系統概述)
2. [核心功能](#核心功能)
3. [系統架構](#系統架構)
4. [技術棧](#技術棧)
5. [專案結構](#專案結構)
6. [環境變數](#環境變數)
7. [安裝與執行](#安裝與執行)
8. [API 說明](#api-說明)
9. [實作進度](#實作進度)

---

## 系統概述

使用者輸入目的地與旅遊日期，系統自動抓取該期間的天氣預報，再由 Gemini AI 依據天氣（晴天安排戶外景點、雨天優先室內）生成完整每日行程。每張景點卡片透過 Google Places API 補充照片、評分與 Google Maps 連結，並支援拖曳排序、景點替換、整日重新生成等互動編輯。行程可儲存至本機或登入後同步雲端，也可產生唯讀分享連結。

---

## 核心功能

### 天氣整合
- 接入 Open-Meteo API，取得目的地未來 16 天逐日天氣（氣溫、降雨機率、天氣代碼）
- 天氣條件影響 AI 選擇景點類型（outdoor / indoor）
- 天氣卡片 CSS 微動畫（晴天光暈、雨天水滴效果）

### AI 行程生成
- 呼叫 Google Gemini 1.5 Flash，以 JSON Schema 結構化輸出
- 每日自動包含早餐、景點、交通、午餐、晚餐、住宿
- 所有項目含地址、經緯度、預估花費、停留時間、推薦理由

### 景點資訊豐富化
- Google Places API (New) Text Search 取得照片、評分、評論數、Google Maps 連結
- 篩選有評論數的結果，避免定位到私人住宅等錯誤地標
- 非阻塞式非同步處理，不影響行程顯示速度

### 行程互動編輯
- 拖曳排序（@dnd-kit）
- 單項景點鎖定 / 刪除 / 替換（AI 提供 3 個替代選項）
- 整日重新生成（保留鎖定項目）
- 確認修改後自動重新計算交通與時間軸

### 地圖視覺化
- react-leaflet 互動地圖，各天行程以不同顏色標記
- 景點、餐飲、住宿各有不同圖示形狀
- 點擊行程卡片，地圖自動飛至對應位置

### 儲存與分享
- 本機儲存（localStorage）
- 雲端儲存（Supabase PostgreSQL，需登入）
- 唯讀分享連結（`/share/:shareId`），無需登入即可瀏覽

### 帳號系統
- Supabase Auth（Email 註冊 / 登入）
- 登入後自動同步雲端行程，未登入仍可使用本機功能

### 預算分析
- 費用總覽卡片：預估總費用範圍 + Recharts 圓餅圖
- 依景點、餐飲、住宿、交通分類顯示佔比

---

## 系統架構

```
使用者瀏覽器
    │
    ├── React 前端 (Vite + TypeScript)
    │       ├── 表單輸入 → useTripPlanner hook
    │       ├── 天氣資料 ← Open-Meteo API
    │       ├── AI 行程  ← Google Gemini API
    │       ├── 座標校正 ← Nominatim (OpenStreetMap)
    │       ├── 景點資訊 ← Google Places API (New)
    │       └── 地圖渲染  ← Leaflet / OpenStreetMap
    │
    └── Supabase (BaaS)
            ├── Auth — 使用者登入 / 註冊
            └── PostgreSQL — 行程雲端儲存 (trips table)
```

**資料流程**：
1. 取得天氣預報 → 2. Gemini 生成行程 JSON → 3. Nominatim 校正座標 → 4. Places API 補充照片評分（非阻塞）→ 5. 渲染畫面

---

## 技術棧

| 類別 | 技術 |
|---|---|
| 前端框架 | React 19 + TypeScript 5 |
| 建構工具 | Vite 8 |
| 樣式 | 純 CSS（無 UI 框架） |
| 圖示 | Lucide React |
| 拖曳 | @dnd-kit/core + @dnd-kit/sortable |
| 地圖 | react-leaflet + Leaflet.js |
| 圖表 | Recharts |
| 路由 | react-router-dom v7 |
| 後端服務 | Supabase（Auth + PostgreSQL） |
| AI | Google Gemini 1.5 Flash (`@google/genai`) |
| 天氣 API | Open-Meteo（免費，無需金鑰） |
| 地理編碼 | Nominatim (OpenStreetMap)（免費，無需金鑰） |
| 景點資料 | Google Places API (New) |
| 部署 | Vercel |

---

## 專案結構

```
travel-planner/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/          # UI 元件
│   │   ├── AuthModal        # 登入 / 註冊 Modal
│   │   ├── BudgetChart      # 費用總覽圓餅圖
│   │   ├── Itinerary        # 行程列表（拖曳、編輯）
│   │   ├── LoadingSkeleton  # 載入骨架屏
│   │   ├── SavedTrips       # 已儲存行程（本機 + 雲端）
│   │   ├── TripForm         # 表單輸入
│   │   ├── TripMap          # Leaflet 互動地圖
│   │   ├── WeatherBackground# 背景主題
│   │   ├── WeatherChart     # 天氣折線圖
│   │   └── WeatherStrip     # 天氣卡片列
│   ├── hooks/
│   │   ├── useAuth.ts       # Supabase 登入狀態
│   │   └── useTripPlanner.ts# 核心行程邏輯
│   ├── pages/
│   │   └── SharedTrip.tsx   # 唯讀分享頁面
│   ├── services/
│   │   ├── gemini.ts        # Gemini AI 呼叫
│   │   ├── generateItinerary.ts  # 無 AI 的 fallback 生成
│   │   ├── geocode.ts       # Nominatim 座標校正
│   │   ├── places.ts        # Google Places API
│   │   ├── storage.ts       # localStorage 操作
│   │   ├── supabase.ts      # Supabase client
│   │   ├── trips.ts         # 雲端行程 CRUD
│   │   └── weather.ts       # Open-Meteo 天氣
│   ├── types/
│   │   └── index.ts         # 全域型別定義
│   ├── utils/
│   │   └── schedule.ts      # 時間軸計算
│   ├── App.tsx
│   └── main.tsx
├── .env.example             # 環境變數範本
├── vercel.json              # Vercel SPA 路由設定
└── INSTALL.md               # 詳細安裝指南
```

---

## 環境變數

複製 `.env.example` 為 `.env.local` 並填入金鑰：

```env
VITE_GEMINI_API_KEY=          # Google Gemini API 金鑰
VITE_SUPABASE_URL=            # Supabase 專案 URL
VITE_SUPABASE_ANON_KEY=       # Supabase anon public key
VITE_GOOGLE_PLACES_API_KEY=   # Google Places API (New) 金鑰
```

> 未設定 Gemini 金鑰時，系統會自動切換至內建的靜態 fallback 行程生成器。
> 未設定 Supabase 時，雲端儲存與登入功能會自動隱藏，其餘功能正常運作。

詳細取得步驟請參考 [INSTALL.md](./INSTALL.md)。

---

## 安裝與執行

```bash
# 1. 複製專案
git clone https://github.com/Yan-Weichen/weather-trip-planner.git
cd weather-trip-planner

# 2. 安裝相依套件
npm install

# 3. 設定環境變數
cp .env.example .env.local
# 編輯 .env.local 填入金鑰

# 4. 啟動開發伺服器
npm run dev
```

詳細的金鑰申請流程、Supabase 資料庫設定，請參考 [INSTALL.md](./INSTALL.md)。

---

## API 說明

| API | 用途 | 費用 |
|---|---|---|
| Open-Meteo | 天氣預報（未來 16 天） | 完全免費 |
| Nominatim | 地名 → 經緯度轉換 | 完全免費 |
| Google Gemini 1.5 Flash | AI 行程生成 | 免費額度充裕 |
| Google Places API (New) | 景點照片 / 評分 / Maps 連結 | 每次約 $0.032，新帳號有 $300 抵免 |
| Supabase | 使用者認證 + 資料庫 | 免費方案（500MB 儲存） |

---

## 實作進度

| 功能 | 狀態 |
|---|---|
| 天氣預報整合 | ✅ 完成 |
| Gemini AI 行程生成 | ✅ 完成 |
| 座標校正（Nominatim） | ✅ 完成 |
| 拖曳排序 | ✅ 完成 |
| 景點替換 / 整日重新生成 | ✅ 完成 |
| Google Places 照片 / 評分 | ✅ 完成 |
| Leaflet 互動地圖 | ✅ 完成 |
| 預算圓餅圖 | ✅ 完成 |
| 本機儲存 | ✅ 完成 |
| Supabase 雲端儲存 | ✅ 完成 |
| 唯讀分享連結 | ✅ 完成 |
| 響應式設計（RWD） | ✅ 完成 |
| 列印 / 匯出 | ✅ 完成 |
