// app.js – 화면 동작 (목록 그리기, 일정 추가)

// 01 단원 : 일정 목록을 코드 안에 둠 (가상 데이터) → 04 단원에서 data/tasks.json 으로 분리
const SAMPLE_TASKS = [
  { title: '다중이용시설 안전점검', region: '세종', kind: '야외', owner: '김안전' },
  { title: '시민 안전체험 행사 운영', region: '보령', kind: '야외', owner: '이행사' },
  { title: '옥상 태양광 설비 점검', region: '태안', kind: '고소', owner: '박설비' },
  { title: '하천 수위계 확인', region: '대전', kind: '야외', owner: '최현장' },
  { title: '청사 외벽 간판 보수', region: '세종', kind: '고소', owner: '정시설' },
  { title: '비상연락 훈련', region: '대전', kind: '실내', owner: '한상황' },
];

let tasks = [];
let weatherByRegion = {};   // 03 단원에서 지역별 날씨를 넣음

function loadTasks() {
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  tasks = SAMPLE_TASKS.concat(saved);
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

function addTask(e) {
  e.preventDefault();
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
  loadTasks();
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
loadTasks();
renderTasks();
loadWeather();
