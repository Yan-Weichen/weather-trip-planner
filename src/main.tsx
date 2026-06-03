/**
 * main.tsx — 應用程式入口點
 *
 * 負責：
 * 1. 將 React App 掛載到 index.html 的 #root 元素
 * 2. 設定 react-router-dom 的 BrowserRouter，啟用前端路由
 * 3. 定義兩條路由：
 *    - "/" → 主頁面（App 元件）
 *    - "/share/:shareId" → 唯讀行程分享頁（SharedTrip 元件）
 * 4. StrictMode：開發模式下雙重執行 effect，幫助提早發現問題
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import SharedTrip from './pages/SharedTrip.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* 主頁面：表單輸入、天氣、行程規劃 */}
        <Route path="/" element={<App />} />
        {/* 分享頁面：根據 shareId 讀取雲端行程，以唯讀方式顯示 */}
        <Route path="/share/:shareId" element={<SharedTrip />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
