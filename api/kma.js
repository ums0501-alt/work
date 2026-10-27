require('../config.js');

const { judge, WEATHER_LOCATIONS } = require('../logic.js');

const KMA_FORECAST_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
const BASE_TIMES = [2, 5, 8, 11, 14, 17, 20, 23];
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function dateKey(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('');
}

function getForecastTimes(now = new Date()) {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const baseTime = new Date(kstNow.getTime() - 30 * 60 * 1000);
  const latestBaseHour = BASE_TIMES.filter((hour) => hour <= baseTime.getUTCHours()).pop();

  if (latestBaseHour === undefined) {
    baseTime.setUTCDate(baseTime.getUTCDate() - 1);
  }

  const hour = latestBaseHour === undefined ? 23 : latestBaseHour;
  return {
    targetDate: dateKey(kstNow),
    baseDate: dateKey(baseTime),
    baseTime: String(hour).padStart(2, '0') + '00',
  };
}

function toKmaGrid(latitude, longitude) {
  const earthRadius = 6371.00877;
  const gridSpacing = 5;
  const radians = Math.PI / 180;
  const standardLat1 = 30 * radians;
  const standardLat2 = 60 * radians;
  const originLon = 126 * radians;
  const originLat = 38 * radians;
  const originX = 43;
  const originY = 136;
  const re = earthRadius / gridSpacing;
  const sn = Math.log(Math.cos(standardLat1) / Math.cos(standardLat2)) /
    Math.log(Math.tan(Math.PI / 4 + standardLat2 / 2) / Math.tan(Math.PI / 4 + standardLat1 / 2));
  const sf = Math.tan(Math.PI / 4 + standardLat1 / 2);
  const scaleFactor = Math.pow(sf, sn) * Math.cos(standardLat1) / sn;
  const originRadius = re * scaleFactor / Math.pow(Math.tan(Math.PI / 4 + originLat / 2), sn);
  const radius = re * scaleFactor / Math.pow(Math.tan(Math.PI / 4 + latitude * radians / 2), sn);
  let theta = longitude * radians - originLon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;

  return {
    nx: Math.floor(radius * Math.sin(theta) + originX + 0.5),
    ny: Math.floor(originRadius - radius * Math.cos(theta) + originY + 0.5),
  };
}

function normalizeItems(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function numericForecastValues(items, category, targetDate) {
  return items
    .filter((item) => item.category === category && item.fcstDate === targetDate)
    .map((item) => Number(item.fcstValue))
    .filter(Number.isFinite);
}

function maxOf(values) {
  return values.length ? Math.max(...values) : null;
}

async function fetchKmaWeather(region) {
  const location = WEATHER_LOCATIONS[region];
  const grid = toKmaGrid(location.latitude, location.longitude);
  const { targetDate, baseDate, baseTime } = getForecastTimes();
  let serviceKey = process.env.KMA_KEY;
  try {
    serviceKey = decodeURIComponent(serviceKey);
  } catch (error) {
    // URLSearchParams will safely encode the original key if it was not URI-encoded.
  }

  const params = new URLSearchParams({
    serviceKey,
    pageNo: '1',
    numOfRows: '1000',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: String(grid.nx),
    ny: String(grid.ny),
  });
  const response = await fetch(KMA_FORECAST_URL + '?' + params.toString());
  if (!response.ok) throw new Error('KMA request failed');

  const payload = await response.json();
  const envelope = payload && payload.response;
  if (!envelope || !envelope.body || (envelope.header && envelope.header.resultCode !== '00')) {
    throw new Error('KMA returned an invalid forecast response');
  }

  const items = normalizeItems(envelope.body.items && envelope.body.items.item);
  const tmxValues = numericForecastValues(items, 'TMX', targetDate);
  const tempValues = tmxValues.length ? tmxValues : numericForecastValues(items, 'TMP', targetDate);
  const windValues = numericForecastValues(items, 'WSD', targetDate);
  const rainValues = numericForecastValues(items, 'POP', targetDate);
  const tempMax = maxOf(tempValues);
  const windMax = maxOf(windValues);
  const rainProb = maxOf(rainValues);

  if (tempMax === null || windMax === null || rainProb === null) {
    throw new Error('KMA response does not include all required values');
  }

  return { tempMax, windMax, rainProb, source: 'KMA', baseDate, baseTime };
}

async function fetchRegionTasks(region) {
  const query = new URLSearchParams({
    select: 'id,title,region,kind,owner,created_at',
    region: 'eq.' + region,
    order: 'created_at.asc,id.asc',
  });
  const url = globalThis.SUPABASE_URL + '/rest/v1/wx_tasks?' + query.toString();
  const response = await fetch(url, {
    headers: {
      apikey: globalThis.SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + globalThis.SUPABASE_PUBLISHABLE_KEY,
    },
  });
  if (!response.ok) throw new Error('Supabase request failed');
  return response.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const region = req.query && req.query.region;
  if (typeof region !== 'string' || !Object.hasOwn(WEATHER_LOCATIONS, region)) {
    return res.status(400).json({ error: 'invalid_region', allowed: Object.keys(WEATHER_LOCATIONS) });
  }
  if (!process.env.KMA_KEY) {
    return res.status(500).json({ error: 'missing_kma_key' });
  }
  if (!globalThis.SUPABASE_URL || !globalThis.SUPABASE_PUBLISHABLE_KEY) {
    return res.status(500).json({ error: 'missing_supabase_config' });
  }

  try {
    const [schedules, weather] = await Promise.all([
      fetchRegionTasks(region),
      fetchKmaWeather(region),
    ]);
    return res.status(200).json({
      region,
      weather,
      schedules: schedules.map((schedule) => ({
        ...schedule,
        weather: {
          tempMax: weather.tempMax,
          windMax: weather.windMax,
          rainProb: weather.rainProb,
        },
        decision: judge(schedule.kind, weather),
      })),
    });
  } catch (error) {
    return res.status(502).json({ error: 'upstream_request_failed' });
  }
};
