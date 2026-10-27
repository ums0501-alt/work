// app.js – 화면 동작 (목록 그리기, 일정 추가)

let tasks = [];
let weatherByRegion = {};   // 03 단원에서 지역별 날씨를 넣음
let tasksReady;

async function loadTasks() {
  const message = document.getElementById('taskLoadMessage');
  message.textContent = '일정 목록을 불러오는 중입니다.';

  let baseTasks;
  try {
    const response = await fetch('data/tasks.json');
    if (!response.ok) throw new Error('일정 JSON을 읽지 못했습니다.');
    baseTasks = await response.json();
    if (!Array.isArray(baseTasks)) throw new Error('일정 JSON 형식이 올바르지 않습니다.');
  } catch (error) {
    tasks = [];
    renderTasks();
    message.textContent = '배포 주소로 열어 주세요';
    return false;
  }

  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  tasks = baseTasks.concat(Array.isArray(saved) ? saved : []);
  message.textContent = '';
  renderTasks();
  return true;
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
  if (!await tasksReady) return;

  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  saved.push(t);
  localStorage.setItem('wx_added', JSON.stringify(saved));
  e.target.reset();
  tasks.push(t);
  renderTasks();
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
