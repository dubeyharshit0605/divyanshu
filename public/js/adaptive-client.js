const API = '/api/adaptive';

const questionCard = document.getElementById('question-card');
const qDiff = document.getElementById('q-diff');
const qProblem = document.getElementById('q-problem');
const qIn = document.getElementById('q-in');
const qOut = document.getElementById('q-out');
const qConst = document.getElementById('q-const');
const qEx = document.getElementById('q-ex');
const resp = document.getElementById('resp');
const interimEl = document.getElementById('interim');
const finalEl = document.getElementById('final');
const typedEl = document.getElementById('typed');
const timerEl = document.getElementById('timer');

let rec = null;
let stopTimer = null;
let running = false;
let finalTranscript = '';

function formatSec(s) {
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const r = (s%60).toString().padStart(2,'0');
  return `${m}:${r}`;
}

function startCountdown(seconds, onDone) {
  let s = seconds;
  timerEl.textContent = formatSec(s);
  stopTimer = () => {};
  const id = setInterval(() => {
    s -= 1;
    timerEl.textContent = formatSec(Math.max(0, s));
    if (s <= 0) {
      clearInterval(id);
      onDone && onDone();
    }
  }, 1000);
  stopTimer = () => clearInterval(id);
}

function createRecognizer() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('SpeechRecognition not supported'); return null; }
  const r = new SR();
  r.lang = 'en-US';
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 1;
  return r;
}

async function fetchQuestion() {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({})
  });
  const data = await res.json();
  // Do not show server response here; user hasn't answered yet
  resp.textContent = '(waiting for answer...)';
  const nq = data?.data?.next_question;
  if (nq) {
    questionCard.style.display = '';
    qDiff.textContent = nq.difficulty || '-';
    qProblem.textContent = nq.problem || '';
    qIn.textContent = nq.input_format || '';
    qOut.textContent = nq.output_format || '';
    qConst.textContent = nq.constraints || '';
    qEx.textContent = nq.example || '';
  }
}

async function submitAnswer(answer) {
  const payload = answer ? { answer } : {};
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  resp.textContent = JSON.stringify(data, null, 2);
  const nq = data?.data?.next_question;
  if (nq) {
    questionCard.style.display = '';
    qDiff.textContent = nq.difficulty || '-';
    qProblem.textContent = nq.problem || '';
    qIn.textContent = nq.input_format || '';
    qOut.textContent = nq.output_format || '';
    qConst.textContent = nq.constraints || '';
    qEx.textContent = nq.example || '';
  }
}

function setMicButtons(listening) {
  document.getElementById('btn-start-mic').disabled = listening;
  document.getElementById('btn-stop-mic').disabled = !listening;
}

function stopMic() {
  if (!running) return;
  running = false;
  try { rec && rec.stop(); } catch {}
  stopTimer && stopTimer();
  setMicButtons(false);
}

async function startMic90s() {
  rec = createRecognizer();
  if (!rec) return;
  finalTranscript = '';
  interimEl.textContent = '';
  finalEl.textContent = '';
  running = true;
  setMicButtons(true);
  startCountdown(90, () => {
    stopMic();
  });

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalTranscript += t + ' ';
      else interim += t;
    }
    interimEl.textContent = interim;
    finalEl.textContent = finalTranscript;
  };

  rec.onerror = () => stopMic();
  rec.onend = async () => {
    if (!running) {
      // stopped manually
    }
    await submitAnswer(finalTranscript.trim());
  };

  try { rec.start(); } catch {}
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-new-q').addEventListener('click', fetchQuestion);
  document.getElementById('btn-start-mic').addEventListener('click', startMic90s);
  document.getElementById('btn-stop-mic').addEventListener('click', stopMic);
  document.getElementById('btn-submit-text').addEventListener('click', async () => {
    await submitAnswer(typedEl.value.trim());
  });
});


