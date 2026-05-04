const QUIZ_COUNT = 6;
const BANK_PREFIX = "compactQuiz_bank_";
const STATE_PREFIX = "compactQuiz_state_";
const TIMER_PREFIX = "compactQuiz_timer_";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function normalizeQuestion(item) {
  return {
    soal: String(item?.soal ?? "").trim(),
    jawaban: Array.isArray(item?.jawaban)
      ? item.jawaban.map((v) => String(v ?? "").trim()).filter(Boolean)
      : [],
    jawaban_benar: String(item?.jawaban_benar ?? "").trim(),
  };
}

function validateQuestion(item, index) {
  if (!item.soal) return `Soal ke-${index + 1} masih kosong.`;
  if (!Array.isArray(item.jawaban) || item.jawaban.length < 2) {
    return `Soal ke-${index + 1} harus punya minimal 2 jawaban.`;
  }
  if (!item.jawaban_benar) {
    return `Soal ke-${index + 1} belum punya jawaban_benar.`;
  }
  if (!item.jawaban.includes(item.jawaban_benar)) {
    return `Soal ke-${index + 1}: jawaban_benar harus ada di daftar jawaban.`;
  }
  return "";
}

function readQuizBank(quizIndex) {
  const raw = localStorage.getItem(`${BANK_PREFIX}${quizIndex}`);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items.map(normalizeQuestion).filter((q) => q.soal && q.jawaban.length >= 2);
  } catch {
    return [];
  }
}

function saveQuizBank(quizIndex, rawValue, onSuccess, onError) {
  try {
    const parsed = JSON.parse(rawValue);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const cleaned = items.map(normalizeQuestion);

    for (let i = 0; i < cleaned.length; i++) {
      const err = validateQuestion(cleaned[i], i);
      if (err) {
        onError?.(err);
        return;
      }
    }

    localStorage.setItem(`${BANK_PREFIX}${quizIndex}`, JSON.stringify(cleaned));
    onSuccess?.(cleaned);
  } catch {
    onError?.("JSON tidak valid. Cek tanda kutip, koma, dan kurung.");
  }
}

function createState(bank) {
  return {
    order: shuffle([...Array(bank.length).keys()]),
    answerOrders: bank.map((q) => shuffle([...Array(q.jawaban.length).keys()])),
    answers: Array.from({ length: bank.length }, () => null),
  };
}

function isValidStateShape(state, bank) {
  if (!state) return false;
  if (!Array.isArray(state.order)) return false;
  if (!Array.isArray(state.answerOrders)) return false;
  if (!Array.isArray(state.answers)) return false;
  if (state.order.length !== bank.length) return false;
  if (state.answerOrders.length !== bank.length) return false;
  if (state.answers.length !== bank.length) return false;

  for (let i = 0; i < bank.length; i++) {
    if (!Array.isArray(state.answerOrders[i])) return false;
    if (state.answerOrders[i].length !== bank[i].jawaban.length) return false;
  }

  return true;
}

function loadState(quizIndex, bank) {
  try {
    const raw = localStorage.getItem(`${STATE_PREFIX}${quizIndex}`);
    if (!raw) return createState(bank);

    const parsed = JSON.parse(raw);
    if (!isValidStateShape(parsed, bank)) {
      return createState(bank);
    }

    return parsed;
  } catch {
    return createState(bank);
  }
}

function saveState(quizIndex, state) {
  localStorage.setItem(`${STATE_PREFIX}${quizIndex}`, JSON.stringify(state));
}

function getScore(state) {
  return state.answers.reduce((sum, item) => sum + (item?.correct ? 1 : 0), 0);
}

function makeStarterText() {
  return JSON.stringify(
    [
      {
        soal: "",
        jawaban: ["", "", "", ""],
        jawaban_benar: "",
      },
    ],
    null,
    2
  );
}

function createTimerState() {
  return {
    elapsed: 0,
    running: true,
    startedAt: Date.now(),
  };
}

function normalizeTimerState(raw) {
  if (!raw || typeof raw !== "object") return createTimerState();

  const elapsed = Number(raw.elapsed ?? 0);
  const running = Boolean(raw.running ?? true);
  const startedAt = Number(raw.startedAt ?? Date.now());

  return {
    elapsed: Number.isFinite(elapsed) && elapsed >= 0 ? Math.floor(elapsed) : 0,
    running,
    startedAt: running && Number.isFinite(startedAt) ? startedAt : Date.now(),
  };
}

function loadTimerState(quizIndex) {
  try {
    const raw = localStorage.getItem(`${TIMER_PREFIX}${quizIndex}`);
    if (!raw) return createTimerState();

    const parsed = normalizeTimerState(JSON.parse(raw));
    return parsed;
  } catch {
    return createTimerState();
  }
}

function saveTimerState(quizIndex, timerState) {
  localStorage.setItem(`${TIMER_PREFIX}${quizIndex}`, JSON.stringify(timerState));
}

function getElapsedSeconds(timerState) {
  if (!timerState.running) return timerState.elapsed;
  return timerState.elapsed + Math.floor((Date.now() - timerState.startedAt) / 1000);
}

function syncTimerToNow(timerState) {
  if (timerState.running) {
    timerState.elapsed = getElapsedSeconds(timerState);
    timerState.startedAt = Date.now();
  }
  return timerState;
}

function setPauseButtonIcon(pauseBtn, isPaused) {
  if (!pauseBtn) return;

  if (isPaused) {
    pauseBtn.title = "Resume";
    pauseBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5v14l11-7-11-7Z" fill="currentColor" />
      </svg>
    `;
  } else {
    pauseBtn.title = "Pause";
    pauseBtn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5h3v14H8V5Zm5 0h3v14h-3V5Z" fill="currentColor" />
      </svg>
    `;
  }
}

function initQuizPage() {
  const quizIndex = Number(document.body.dataset.quiz || "1");
  const quizTitle = document.getElementById("quizTitle");
  const scoreText = document.getElementById("scoreText");
  const timerText = document.getElementById("timerText");
  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const container = document.getElementById("quizContainer");

  quizTitle.textContent = `Quiz ${quizIndex}`;

  let bank = readQuizBank(quizIndex);
  let timerState = loadTimerState(quizIndex);
  let timerInterval = null;

  function updateTimerUI() {
    if (!timerText) return;
    timerText.textContent = formatTime(getElapsedSeconds(timerState));
  }

  function startTimerLoop() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (timerState.running) {
        updateTimerUI();
        saveTimerState(quizIndex, timerState);
      }
    }, 1000);
  }

  function pauseTimer() {
    if (!timerState.running) return;
    syncTimerToNow(timerState);
    timerState.running = false;
    timerState.startedAt = null;
    saveTimerState(quizIndex, timerState);
    updateTimerUI();
    setPauseButtonIcon(pauseBtn, true);
  }

  function resumeTimer() {
    if (timerState.running) return;
    timerState.running = true;
    timerState.startedAt = Date.now();
    saveTimerState(quizIndex, timerState);
    updateTimerUI();
    setPauseButtonIcon(pauseBtn, false);
  }

  if (!bank.length) {
    scoreText.textContent = "0 / 0";
    if (timerText) timerText.textContent = "00:00";
    container.innerHTML = `
      <div class="card-shell pastel-peach p-4">
        <p class="text-sm font-bold text-slate-900">Belum ada soal tersimpan.</p>
        <p class="mt-1 text-sm text-slate-700">
          Buka Bank Soal lalu simpan JSON untuk Quiz ${quizIndex}.
        </p>
        <a href="banksoal.html" class="mt-3 inline-block solid-btn">Buka Bank Soal</a>
      </div>
    `;
    resetBtn.disabled = true;
    if (pauseBtn) pauseBtn.disabled = true;
    return;
  }

  let state = loadState(quizIndex, bank);

  function render() {
    scoreText.textContent = `${getScore(state)} / ${bank.length}`;
    container.innerHTML = "";

    state.order.forEach((bankIndex, renderIndex) => {
      const question = bank[bankIndex];
      const answerState = state.answers[renderIndex];
      const answerOrder =
        state.answerOrders[bankIndex] || [...Array(question.jawaban.length).keys()];

      const article = document.createElement("article");
      article.className = "card-shell pastel-cream p-3";
      article.innerHTML = `
        <div class="mb-2 flex items-center justify-between gap-2">
          <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-600">Soal ${renderIndex + 1}</p>
          <span class="text-[11px] font-bold text-slate-500">#${bankIndex + 1}</span>
        </div>

        <p class="whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-900">
          ${escapeHtml(question.soal)}
        </p>

        <div class="mt-2 hidden result-box text-sm" data-role="result"></div>

        <div class="mt-3 grid grid-cols-2 gap-2">
          ${answerOrder
            .map((optionIndex) => {
              const answer = question.jawaban[optionIndex];
              return `
                <button
                  type="button"
                  class="answer-btn text-sm"
                  data-option="${optionIndex}"
                >
                  ${escapeHtml(answer)}
                </button>
              `;
            })
            .join("")}
        </div>
      `;

      const resultEl = article.querySelector('[data-role="result"]');
      const buttons = [...article.querySelectorAll("[data-option]")];

      if (answerState) {
        resultEl.classList.remove("hidden");
        resultEl.innerHTML = `
          <strong>Jawaban:</strong> ${escapeHtml(answerState.selected)}
          <span class="ml-2 font-bold ${answerState.correct ? "text-emerald-700" : "text-rose-700"}">
            (${answerState.correct ? "Benar" : "Salah"})
          </span>
        `;

        buttons.forEach((btn) => {
          const optionText = question.jawaban[Number(btn.dataset.option)];
          btn.disabled = true;

          if (optionText === question.jawaban_benar) {
            btn.classList.add("correct");
          }

          if (optionText === answerState.selected && !answerState.correct) {
            btn.classList.add("wrong");
          }
        });
      } else {
        resultEl.classList.add("hidden");
      }

      buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
          if (state.answers[renderIndex]) return;

          const selected = question.jawaban[Number(btn.dataset.option)];
          const correct = selected === question.jawaban_benar;

          state.answers[renderIndex] = { selected, correct };
          saveState(quizIndex, state);
          render();
        });
      });

      container.appendChild(article);
    });
  }

  if (pauseBtn) {
    setPauseButtonIcon(pauseBtn, !timerState.running);

    pauseBtn.addEventListener("click", () => {
      if (timerState.running) {
        pauseTimer();
      } else {
        resumeTimer();
      }
    });
  }

  resetBtn.addEventListener("click", () => {
    state = createState(bank);

    timerState = createTimerState();
    saveState(quizIndex, state);
    saveTimerState(quizIndex, timerState);

    render();
    updateTimerUI();
    setPauseButtonIcon(pauseBtn, false);
  });

  updateTimerUI();
  startTimerLoop();
  render();

  window.addEventListener("beforeunload", () => {
    saveState(quizIndex, state);
    saveTimerState(quizIndex, timerState);
  });
  window.addEventListener("pagehide", () => {
    saveState(quizIndex, state);
    saveTimerState(quizIndex, timerState);
  });
}

function initBankPage() {
  const globalStatus = document.getElementById("bankGlobalStatus");
  const saveBtn = document.getElementById("saveAllBtn");

  for (let i = 1; i <= QUIZ_COUNT; i++) {
    const textarea = document.getElementById(`bank-${i}`);
    const existing = localStorage.getItem(`${BANK_PREFIX}${i}`);

    if (existing) {
      try {
        textarea.value = JSON.stringify(JSON.parse(existing), null, 2);
      } catch {
        textarea.value = makeStarterText();
      }
    } else {
      textarea.value = makeStarterText();
    }
  }

  function setRowStatus(index, ok, message) {
    const statusEl = document.getElementById(`bank-status-${index}`);
    const errorEl = document.getElementById(`bank-error-${index}`);

    if (ok) {
      statusEl.textContent = "Tersimpan";
      statusEl.className = "text-[11px] font-bold text-emerald-700";
      errorEl.textContent = "";
    } else {
      statusEl.textContent = "Error";
      statusEl.className = "text-[11px] font-bold text-rose-700";
      errorEl.textContent = message;
    }
  }

  saveBtn.addEventListener("click", () => {
    let errorCount = 0;

    for (let i = 1; i <= QUIZ_COUNT; i++) {
      const textarea = document.getElementById(`bank-${i}`);

      saveQuizBank(
        i,
        textarea.value,
        () => setRowStatus(i, true, ""),
        (message) => {
          errorCount += 1;
          setRowStatus(i, false, message);
        }
      );
    }

    globalStatus.textContent = errorCount
      ? `Ada ${errorCount} bank soal yang belum valid.`
      : "Semua bank soal berhasil disimpan.";

    globalStatus.className = errorCount
      ? "text-center text-sm font-semibold text-rose-700"
      : "text-center text-sm font-semibold text-emerald-700";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "quiz") initQuizPage();
  if (page === "bank") initBankPage();
});