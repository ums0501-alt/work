// logic.js – 판단 규칙만 (화면을 다루는 코드 금지)

// 교육용 가상 기준 (실제 작업 중지 · 행사 취소 기준은 각 기관 규정을 따름)
const RULES = { wind: 10, rain: 60, heat: 33 };

// Open-Meteo forecast coordinates for the four supported regions.
const WEATHER_LOCATIONS = {
  '세종': { latitude: 36.4801, longitude: 127.2892 },
  '대전': { latitude: 36.3504, longitude: 127.3845 },
  '태안': { latitude: 36.7456, longitude: 126.2980 },
  '보령': { latitude: 36.3333, longitude: 126.6128 },
};

function buildWeatherUrl(region) {
  const location = WEATHER_LOCATIONS[region];
  if (!location) throw new Error('지원하지 않는 지역입니다: ' + region);

  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    daily: 'temperature_2m_max,wind_speed_10m_max,precipitation_probability_max',
    wind_speed_unit: 'ms',
    timezone: 'Asia/Seoul',
    forecast_days: '1',
  });
  return 'https://api.open-meteo.com/v1/forecast?' + params.toString();
}

function parseWeatherResponse(data) {
  const daily = data && data.daily;
  if (!daily) return null;

  const [tempMax] = daily.temperature_2m_max || [];
  const [windMax] = daily.wind_speed_10m_max || [];
  const [rainProb] = daily.precipitation_probability_max || [];
  if (![tempMax, windMax, rainProb].every(Number.isFinite)) return null;

  return { tempMax, windMax, rainProb };
}

// 일정 구분과 날씨로 판단 (w가 없으면 '날씨 확인 전')
function judge(kind, w) {
  if (!w) return { level: 'none', text: '날씨 확인 전' };
  if (kind === '실내') return { level: 'ok', text: '영향 없음' };
  if (kind === '고소' && w.windMax >= RULES.wind) return { level: 'stop', text: '중지 검토 (강풍)' };
  if (w.tempMax >= RULES.heat) return { level: 'warn', text: '폭염 휴식' };
  if (w.rainProb >= RULES.rain) return { level: 'warn', text: '우천 주의' };
  return { level: 'ok', text: '진행' };
}

if (typeof module !== 'undefined') {
  module.exports = { RULES, WEATHER_LOCATIONS, buildWeatherUrl, parseWeatherResponse, judge };
}
