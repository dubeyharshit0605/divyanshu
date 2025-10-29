const API = '/api/adaptive';

async function getQuestion() {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({})
  });
  const data = await res.json();
  return {
    ok: !!data?.success,
    problem: data?.data?.next_question?.problem || 'Question unavailable',
    raw: data
  };
}

function createRecognizer() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('SpeechRecognition not supported in this browser'); return null; }
  const rec = new SR();
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  return rec;
}

let rec = null;
let finalTranscript = '';
let timer = null;
let stopped = false;

function enableButtons(listening) {
  document.getElementById('start').disabled = listening;
  document.getElementById('stop').disabled = !listening;
}

function stopAll() {
  if (stopped) return;
  stopped = true;
  try { rec && rec.stop(); } catch {}
  enableButtons(false);
}

async function askAndListen90s() {
  const out = document.getElementById('out');
  out.textContent = 'Fetching question...';
  const q = await getQuestion();
  out.textContent = `Question:\n${q.problem}\n\nListening for 90 seconds...`;

  rec = createRecognizer();
  if (!rec) return;
  finalTranscript = '';
  stopped = false;
  enableButtons(true);

  timer = setTimeout(() => {
    out.textContent += '\nTime up. Stopping...';
    stopAll();
  }, 90_000);

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalTranscript += t + ' ';
      else interim += t;
    }
    out.textContent = `Question:\n${q.problem}\n\nListening...\n\nInterim: ${interim}\nFinal: ${finalTranscript}`;
  };

  rec.onerror = (e) => {
    out.textContent += `\nError: ${e.error}`;
    stopAll();
  };

  rec.onend = async () => {
    clearTimeout(timer);
    out.textContent += `\nSending answer...`;
    const answerToSend = finalTranscript.trim();
    const payload = answerToSend ? { answer: answerToSend } : {};
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    out.textContent = `Server response:\n${JSON.stringify(data, null, 2)}`;
  };

  rec.start();
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('start').addEventListener('click', askAndListen90s);
  document.getElementById('stop').addEventListener('click', stopAll);
});


