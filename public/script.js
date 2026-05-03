const QUIZ_COUNT = 6;
const BANK_PREFIX = "compactQuiz_bank_";
const STATE_PREFIX = "compactQuiz_state_";

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

function getDisplayCount(total) {
  if (total <= 0) return 0;
  return Math.max(1, Math.floor(total * 0.8));
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
    return items
      .map(normalizeQuestion)
      .filter((q) => q.soal && q.jawaban.length >= 2);
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

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function normalizeTimer(timer) {
  const elapsed = Math.max(0, Math.floor(Number(timer?.elapsed ?? 0)));
  const running = Boolean(timer?.running ?? true);
  const startedAtRaw = Number(timer?.startedAt ?? Date.now());

  return {
    elapsed,
    running,
    startedAt: running && Number.isFinite(startedAtRaw) ? startedAtRaw : null,
  };
}

function getTimerElapsed(timer) {
  const elapsed = Math.max(0, Math.floor(Number(timer?.elapsed ?? 0)));

  if (timer?.running && Number.isFinite(Number(timer?.startedAt))) {
    return elapsed + Math.max(0, Math.floor((Date.now() - Number(timer.startedAt)) / 1000));
  }

  return elapsed;
}

function createState(bank) {
  const total = bank.length;
  const displayCount = getDisplayCount(total);

  if (!total || !displayCount) {
    return {
      order: [],
      optionOrders: [],
      answers: [],
      timer: {
        elapsed: 0,
        running: true,
        startedAt: Date.now(),
      },
    };
  }

  const order = shuffle([...Array(total).keys()]).slice(0, displayCount);

  const optionOrders = order.map((bankIndex) => {
    const answerCount = bank[bankIndex].jawaban.length;
    return shuffle([...Array(answerCount).keys()]);
  });

  return {
    order,
    optionOrders,
    answers: Array.from({ length: displayCount }, () => null),
    timer: {
      elapsed: 0,
      running: true,
      startedAt: Date.now(),
    },
  };
}

function isValidSavedState(state, bank) {
  const displayCount = getDisplayCount(bank.length);

  if (!state) return false;
  if (!Array.isArray(state.order)) return false;
  if (!Array.isArray(state.optionOrders)) return false;
  if (!Array.isArray(state.answers)) return false;
  if (state.order.length !== displayCount) return false;
  if (state.optionOrders.length !== displayCount) return false;
  if (state.answers.length !== displayCount) return false;

  for (let i = 0; i < state.order.length; i++) {
    const bankIndex = state.order[i];
    if (
      typeof bankIndex !== "number" ||
      bankIndex < 0 ||
      bankIndex >= bank.length
    ) {
      return false;
    }

    const q = bank[bankIndex];
    const optionOrder = state.optionOrders[i];

    if (!Array.isArray(optionOrder)) return false;
    if (optionOrder.length !== q.jawaban.length) return false;

    const sorted = [...optionOrder].sort((a, b) => a - b);
    for (let j = 0; j < sorted.length; j++) {
      if (sorted[j] !== j) return false;
    }
  }

  return true;
}

function loadState(quizIndex, bank) {
  try {
    const raw = localStorage.getItem(`${STATE_PREFIX}${quizIndex}`);
    if (!raw) return createState(bank);

    const parsed = JSON.parse(raw);
    if (!isValidSavedState(parsed, bank)) {
      return createState(bank);
    }

    return {
      ...parsed,
      timer: normalizeTimer(parsed.timer),
    };
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

function pauseTimer(state) {
  if (!state.timer.running) return;
  state.timer.elapsed = getTimerElapsed(state.timer);
  state.timer.running = false;
  state.timer.startedAt = null;
}

function resumeTimer(state) {
  if (state.timer.running) return;
  state.timer.running = true;
  state.timer.startedAt = Date.now();
}

function getPauseIcon(running) {
  if (running) {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 5h3v14H8V5Zm5 0h3v14h-3V5Z" fill="currentColor"/>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7L8 5Z" fill="currentColor"/>
    </svg>
  `;
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

  const bank = readQuizBank(quizIndex);

  if (!bank.length) {
    scoreText.textContent = "0 / 0";
    timerText.textContent = "00:00";
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
    pauseBtn.disabled = true;
    return;
  }

  let state = loadState(quizIndex, bank);
  saveState(quizIndex, state);

  function updateHeader() {
    const totalSoal = state.order.length;
    scoreText.textContent = `${getScore(state)} / ${totalSoal}`;
    timerText.textContent = formatTime(getTimerElapsed(state.timer));
    pauseBtn.innerHTML = getPauseIcon(state.timer.running);
    pauseBtn.title = state.timer.running ? "Pause" : "Lanjutkan";
  }

  function render() {
    container.innerHTML = "";

    state.order.forEach((bankIndex, renderIndex) => {
      const question = bank[bankIndex];
      const answerState = state.answers[renderIndex];
      const optionOrder = state.optionOrders[renderIndex] || [];

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
          ${optionOrder
            .map((answerIndex) => {
              const answerText = question.jawaban[answerIndex];
              return `
                <button
                  type="button"
                  class="answer-btn text-sm"
                  data-answer-index="${answerIndex}"
                >
                  ${escapeHtml(answerText)}
                </button>
              `;
            })
            .join("")}
        </div>
      `;

      const resultEl = article.querySelector('[data-role="result"]');
      const buttons = [...article.querySelectorAll("[data-answer-index]")];

      if (answerState) {
        resultEl.classList.remove("hidden");
        resultEl.innerHTML = `
          <strong>Jawaban:</strong> ${escapeHtml(answerState.selected)}
          <span class="ml-2 font-bold ${answerState.correct ? "text-emerald-700" : "text-rose-700"}">
            (${answerState.correct ? "Benar" : "Salah"})
          </span>
        `;

        buttons.forEach((btn) => {
          const answerIndex = Number(btn.dataset.answerIndex);
          const optionText = question.jawaban[answerIndex];
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

          const answerIndex = Number(btn.dataset.answerIndex);
          const selected = question.jawaban[answerIndex];
          const correct = selected === question.jawaban_benar;

          state.answers[renderIndex] = { selected, correct };
          saveState(quizIndex, state);
          render();
        });
      });

      container.appendChild(article);
    });

    updateHeader();
  }

  pauseBtn.addEventListener("click", () => {
    if (state.timer.running) {
      pauseTimer(state);
    } else {
      resumeTimer(state);
    }

    saveState(quizIndex, state);
    updateHeader();
  });

  resetBtn.addEventListener("click", () => {
    state = createState(bank);
    saveState(quizIndex, state);
    render();
  });

  render();

  setInterval(() => {
    if (state.timer.running) {
      timerText.textContent = formatTime(getTimerElapsed(state.timer));
    }
  }, 1000);
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