import { useState, useRef } from 'react';
import TripForm from './components/TripForm';
import WeatherStrip from './components/WeatherStrip';
import WeatherChart from './components/WeatherChart';
import Itinerary from './components/Itinerary';
import TripMap, { DAY_COLORS } from './components/TripMap';
import LoadingSkeleton from './components/LoadingSkeleton';
import WeatherBackground from './components/WeatherBackground';
import BudgetChart from './components/BudgetChart';
import SavedTrips from './components/SavedTrips';
import AuthModal from './components/AuthModal';
import { useTripPlanner } from './hooks/useTripPlanner';
import { useAuth } from './hooks/useAuth';
import { saveTrip } from './services/storage';
import { saveCloudTrip } from './services/trips';
import './App.css';

function getWeatherTheme(weatherData: { precipProbability: number; weatherCode: number }[]) {
  if (weatherData.length === 0) return '';
  const avgPrecip = weatherData.reduce((s, d) => s + d.precipProbability, 0) / weatherData.length;
  if (avgPrecip > 50) return 'theme-rainy';
  const avgCode = weatherData.reduce((s, d) => s + d.weatherCode, 0) / weatherData.length;
  if (avgCode <= 2) return 'theme-sunny';
  return 'theme-cloudy';
}

function App() {
  const {
    loading, error, weatherData, tripPlan, cityName,
    plan, reset, reorderItems, deleteItem, toggleLock,
    replaceItem, fetchReplacementCandidates, confirmDayEdit, regenerateDay, loadTripPlan,
  } = useTripPlanner();
  const { user, loading: authLoading, signIn, signUp, signOut, hasSupabase } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [highlightDay, setHighlightDay] = useState<number | null>(null);
  const [highlightItem, setHighlightItem] = useState<number | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const themeClass = getWeatherTheme(weatherData);
  const bgTheme = themeClass.replace('theme-', '') as 'sunny' | 'rainy' | 'cloudy' | '';
  const hasResult = tripPlan && !loading;

  const handleItemClick = (dayIdx: number, itemIdx: number) => {
    if (highlightDay === dayIdx && highlightItem === itemIdx) {
      setHighlightDay(null);
      setHighlightItem(null);
    } else {
      setHighlightDay(dayIdx);
      setHighlightItem(itemIdx);
    }
  };

  const clearHighlight = () => {
    setHighlightDay(null);
    setHighlightItem(null);
  };

  return (
    <div className={`app ${themeClass}`}>
      <WeatherBackground theme={bgTheme} />
      <header className="app-header">
        {hasSupabase && (
          <div className="auth-bar no-print">
            {authLoading ? null : user ? (
              <div className="auth-user-info">
                <span className="auth-user-email">{user.email}</span>
                <button className="auth-logout-btn" onClick={signOut}>登出</button>
              </div>
            ) : (
              <button className="auth-login-btn" onClick={() => setShowAuthModal(true)}>登入 / 註冊</button>
            )}
          </div>
        )}
        <div className="hero">
          <h1>AI 旅遊行程規劃師</h1>
          <p className="subtitle">根據即時天氣，用 AI 智慧規劃你的完美旅程</p>
          {!hasResult && (
            <div className="hero-features">
              <span className="hero-chip">☀️ 即時天氣</span>
              <span className="hero-chip">🤖 AI 行程</span>
              <span className="hero-chip">🗺️ 互動地圖</span>
              <span className="hero-chip">📊 天氣圖表</span>
            </div>
          )}
        </div>
      </header>

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSignIn={signIn}
          onSignUp={signUp}
        />
      )}

      <main className="app-main" ref={printRef}>
        <SavedTrips onLoad={(tp) => { clearHighlight(); loadTripPlan(tp); }} user={user} />
        <TripForm onSubmit={(data) => { clearHighlight(); plan(data); }} loading={loading} />

        {error && (
          <div className="error-msg">
            <span className="error-icon">⚠️</span>
            <div>
              <strong>發生錯誤</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {loading && <LoadingSkeleton />}

        {hasResult && (
          <div className="results-container">
            <div className="weather-section">
              <h2>{cityName} — 天氣預報</h2>
              <WeatherStrip days={weatherData} />
              <WeatherChart days={weatherData} />
            </div>

            {tripPlan.totalBudgetMin > 0 && (
              <div className="total-budget">
                💰 整趟預估費用：NT${tripPlan.totalBudgetMin.toLocaleString()}–{tripPlan.totalBudgetMax.toLocaleString()}
                <span className="budget-note">（估算值，實際依消費而定）</span>
              </div>
            )}

            <div className="trip-layout">
              <div className="trip-itinerary">
                <div className="section-header">
                  <h2>行程規劃</h2>
                  <div className="section-header-actions no-print">
                    <button className="save-btn" onClick={async () => {
                      saveTrip(tripPlan);
                      if (user) {
                        try {
                          await saveCloudTrip(tripPlan);
                          alert('行程已儲存至本機及雲端！');
                        } catch {
                          alert('本機已儲存，但雲端儲存失敗。');
                        }
                      } else {
                        alert('行程已儲存至本機！登入後可同步至雲端。');
                      }
                    }}>
                      💾 儲存行程
                    </button>
                    <button className="export-btn" onClick={() => window.print()}>
                      🖨️ 匯出 / 列印
                    </button>
                  </div>
                </div>
                <Itinerary
                  dailyPlans={tripPlan.dailyPlans}
                  highlightDayIndex={highlightDay}
                  highlightItemIndex={highlightItem}
                  onItemClick={handleItemClick}
                  onReorder={reorderItems}
                  onDelete={deleteItem}
                  onToggleLock={toggleLock}
                  onReplace={replaceItem}
                  onFetchCandidates={fetchReplacementCandidates}
                  onConfirmDayEdit={confirmDayEdit}
                  onRegenerateDay={(dayIdx) => regenerateDay(dayIdx, [])}
                />
              </div>
              <div className="trip-map-col no-print">
                <h2>行程地圖</h2>
                <div className="map-sticky">
                  <TripMap
                    dailyPlans={tripPlan.dailyPlans}
                    highlightDayIndex={highlightDay}
                    highlightItemIndex={highlightItem}
                  />
                  <div className="map-legend">
                    {tripPlan.dailyPlans.map((day, i) => (
                      <span key={day.dayNumber} className="legend-item">
                        <span
                          className="legend-dot"
                          style={{ background: DAY_COLORS[i % DAY_COLORS.length] }}
                        />
                        第 {day.dayNumber} 天
                      </span>
                    ))}
                  </div>
                  {highlightDay !== null && highlightItem !== null && (
                    <button className="clear-highlight" onClick={clearHighlight}>
                      ✕ 取消高亮
                    </button>
                  )}
                </div>
              </div>
            </div>
            <BudgetChart tripPlan={tripPlan} />

            <div className="reset-row no-print">
              <button className="reset-btn" onClick={() => { reset(); clearHighlight(); }}>
                重新規劃
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer no-print">
        <p>AI 旅遊行程規劃師 — 使用 Open-Meteo 天氣 API + Google Gemini AI</p>
      </footer>
    </div>
  );
}

export default App;
