import type { DayWeather } from '../types';

interface GeoResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
}

const zhToEn: Record<string, string> = {
  '東京': 'Tokyo', '大阪': 'Osaka', '京都': 'Kyoto', '名古屋': 'Nagoya',
  '福岡': 'Fukuoka', '札幌': 'Sapporo', '沖繩': 'Okinawa', '北海道': 'Hokkaido',
  '橫濱': 'Yokohama', '神戶': 'Kobe', '奈良': 'Nara', '廣島': 'Hiroshima',
  '台北': 'Taipei', '台中': 'Taichung', '高雄': 'Kaohsiung', '台南': 'Tainan',
  '花蓮': 'Hualien', '墾丁': 'Kenting', '嘉義': 'Chiayi', '新竹': 'Hsinchu',
  '基隆': 'Keelung', '宜蘭': 'Yilan', '桃園': 'Taoyuan', '屏東': 'Pingtung',
  '台東': 'Taitung', '澎湖': 'Penghu', '南投': 'Nantou', '苗栗': 'Miaoli',
  '彰化': 'Changhua', '雲林': 'Yunlin',
  '首爾': 'Seoul', '釜山': 'Busan', '濟州': 'Jeju',
  '曼谷': 'Bangkok', '清邁': 'Chiang Mai', '普吉': 'Phuket',
  '新加坡': 'Singapore', '吉隆坡': 'Kuala Lumpur',
  '河內': 'Hanoi', '胡志明市': 'Ho Chi Minh City', '峴港': 'Da Nang',
  '香港': 'Hong Kong', '澳門': 'Macau',
  '上海': 'Shanghai', '北京': 'Beijing', '深圳': 'Shenzhen', '廣州': 'Guangzhou',
  '成都': 'Chengdu', '杭州': 'Hangzhou', '西安': 'Xian', '重慶': 'Chongqing',
  '南京': 'Nanjing', '武漢': 'Wuhan', '蘇州': 'Suzhou', '天津': 'Tianjin',
  '巴黎': 'Paris', '倫敦': 'London', '羅馬': 'Rome', '巴塞隆納': 'Barcelona',
  '阿姆斯特丹': 'Amsterdam', '柏林': 'Berlin', '維也納': 'Vienna',
  '布拉格': 'Prague', '蘇黎世': 'Zurich', '慕尼黑': 'Munich',
  '米蘭': 'Milan', '威尼斯': 'Venice', '佛羅倫斯': 'Florence',
  '馬德里': 'Madrid', '里斯本': 'Lisbon', '雅典': 'Athens',
  '伊斯坦堡': 'Istanbul', '莫斯科': 'Moscow',
  '紐約': 'New York', '洛杉磯': 'Los Angeles', '舊金山': 'San Francisco',
  '芝加哥': 'Chicago', '拉斯維加斯': 'Las Vegas', '西雅圖': 'Seattle',
  '夏威夷': 'Hawaii', '波士頓': 'Boston', '邁阿密': 'Miami',
  '溫哥華': 'Vancouver', '多倫多': 'Toronto',
  '雪梨': 'Sydney', '墨爾本': 'Melbourne', '奧克蘭': 'Auckland',
  '杜拜': 'Dubai', '開羅': 'Cairo',
};

async function searchCity(name: string): Promise<GeoResult | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=zh`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding API 請求失敗');
  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;
  const r = data.results[0];
  return { name: r.name, latitude: r.latitude, longitude: r.longitude, country: r.country };
}

export async function geocodeCity(city: string): Promise<GeoResult> {
  // 先直接搜尋原始輸入
  const direct = await searchCity(city);
  if (direct) return direct;

  // 查中文對照表，用英文名重搜
  const en = zhToEn[city];
  if (en) {
    const fallback = await searchCity(en);
    if (fallback) return fallback;
  }

  throw new Error(`找不到城市「${city}」，請嘗試輸入英文名稱`);
}

export async function getForecast(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<DayWeather[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&start_date=${startDate}&end_date=${endDate}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('天氣 API 請求失敗');
  const data = await res.json();
  const d = data.daily;

  return d.time.map((date: string, i: number) => {
    const code = d.weathercode[i];
    const { text, emoji } = weatherCodeToText(code);
    return {
      date,
      weatherCode: code,
      maxTemp: d.temperature_2m_max[i],
      minTemp: d.temperature_2m_min[i],
      precipProbability: d.precipitation_probability_max[i] ?? 0,
      description: text,
      emoji,
    } satisfies DayWeather;
  });
}

export function weatherCodeToText(code: number): { text: string; emoji: string } {
  const map: Record<number, { text: string; emoji: string }> = {
    0: { text: '晴天', emoji: '☀️' },
    1: { text: '大致晴朗', emoji: '🌤️' },
    2: { text: '局部多雲', emoji: '⛅' },
    3: { text: '多雲', emoji: '☁️' },
    45: { text: '霧', emoji: '🌫️' },
    48: { text: '霧淞', emoji: '🌫️' },
    51: { text: '小毛雨', emoji: '🌦️' },
    53: { text: '中毛雨', emoji: '🌦️' },
    55: { text: '大毛雨', emoji: '🌧️' },
    56: { text: '凍毛雨', emoji: '🌧️' },
    57: { text: '強凍毛雨', emoji: '🌧️' },
    61: { text: '小雨', emoji: '🌧️' },
    63: { text: '中雨', emoji: '🌧️' },
    65: { text: '大雨', emoji: '🌧️' },
    66: { text: '凍雨', emoji: '🌧️' },
    67: { text: '強凍雨', emoji: '🌧️' },
    71: { text: '小雪', emoji: '🌨️' },
    73: { text: '中雪', emoji: '🌨️' },
    75: { text: '大雪', emoji: '❄️' },
    77: { text: '雪粒', emoji: '❄️' },
    80: { text: '小陣雨', emoji: '🌦️' },
    81: { text: '中陣雨', emoji: '🌧️' },
    82: { text: '強陣雨', emoji: '🌧️' },
    85: { text: '小陣雪', emoji: '🌨️' },
    86: { text: '大陣雪', emoji: '❄️' },
    95: { text: '雷暴', emoji: '⛈️' },
    96: { text: '雷暴伴小冰雹', emoji: '⛈️' },
    99: { text: '雷暴伴大冰雹', emoji: '⛈️' },
  };
  return map[code] ?? { text: '未知', emoji: '❓' };
}
