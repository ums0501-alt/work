// app.js – 화면 동작 (목록 그리기, 일정 추가)

let tasks = [];
let weatherByRegion = {};   // 03 단원에서 지역별 날씨를 넣음
let tasksReady;
const supabaseClient = window.supabase && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

async function loadTasks() {
  const message = document.getElementById('taskLoadMessage');
  message.textContent = 'Supabase에서 일정을 불러오는 중입니다.';
  if (!supabaseClient) {
    tasks = [];
    renderTasks();
    message.textContent = window.supabase
      ? 'config.js에 Supabase URL과 공개용 키를 입력해 주세요.'
      : 'Supabase 스크립트를 불러오지 못했습니다.';
    return false;
  }

  try {
    const { data, error } = await supabaseClient
      .from('wx_tasks')
      .select('id, title, region, kind, owner, created_at')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw error;
    tasks = data || [];
    message.textContent = '';
    renderTasks();
    return true;
  } catch (error) {
    tasks = [];
    renderTasks();
    message.textContent = '일정을 불러오지 못했습니다. setup.sql 실행과 config.js 연결 정보를 확인해 주세요.';
    return false;
  }
}

function weatherText(w) {
  return w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
}

function renderTasks() {
  const body = document.getElementById('taskList');
  body.innerHTML = '';
  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const r = judge(t.kind, w);
    const tr = document.createElement('tr');
    for (const v of [t.title, t.region, t.kind, t.owner, weatherText(w)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    td.textContent = r.text;
    td.className = r.level;
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

async function addTask(e) {
  e.preventDefault();
  const message = document.getElementById('msgBox');
  if (!await tasksReady) {
    message.textContent = 'Supabase에서 일정을 불러온 뒤 다시 시도해 주세요.';
    return;
  }

  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  message.textContent = '일정을 저장하는 중입니다.';
  try {
    const { data, error } = await supabaseClient
      .from('wx_tasks')
      .insert([t])
      .select('id, title, region, kind, owner, created_at')
      .single();
    if (error) throw error;
    tasks.push(data);
    e.target.reset();
    message.textContent = '';
    renderTasks();
  } catch (error) {
    message.textContent = '일정을 저장하지 못했습니다. DB 연결과 표 권한을 확인해 주세요.';
  }
}

async function loadWeather() {
  const weatherBox = document.getElementById('weatherBox');
  weatherBox.textContent = '오늘 날씨를 불러오는 중입니다.';

  const testWind = new URLSearchParams(window.location.search).get('test') === 'wind';
  const results = await Promise.allSettled(
    Object.keys(WEATHER_LOCATIONS).map(async (region) => {
      const response = await fetch(buildWeatherUrl(region));
      if (!response.ok) throw new Error('날씨 API 응답 오류: ' + response.status);
      const weather = parseWeatherResponse(await response.json());
      if (!weather) throw new Error('날씨 응답 형식이 올바르지 않습니다.');
      if (testWind) weather.windMax = 12;
      weatherByRegion[region] = weather;
    })
  );

  const failedCount = results.filter((result) => result.status === 'rejected').length;
  weatherBox.textContent = failedCount === 0
    ? '지역별 오늘 날씨를 일정에 표시했습니다.'
    : failedCount === results.length
      ? '날씨를 가져오지 못했습니다. 일정은 표시 중입니다.'
      : '일부 지역 날씨를 가져오지 못했습니다. 일정은 표시 중입니다.';
  renderTasks();
}

const now = new Date();
document.getElementById('todayDate').textContent = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
].join('-');

document.getElementById('taskForm').addEventListener('submit', addTask);
tasksReady = loadTasks();
tasksReady.then((loaded) => {
  if (loaded) loadWeather();
});
