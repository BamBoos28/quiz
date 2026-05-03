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
  } catch (error) {
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

function initQuizPage() {
  const quizIndex = Number(document.body.dataset.quiz || "1");
  const quizTitle = document.getElementById("quizTitle");
  const scoreText = document.getElementById("scoreText");
  const resetBtn = document.getElementById("resetBtn");
  const container = document.getElementById("quizContainer");

  quizTitle.textContent = `Quiz ${quizIndex}`;

  let bank = readQuizBank(quizIndex);

  if (!bank.length) {
    scoreText.textContent = "0 / 0";
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
    return;
  }

  let state = loadState(quizIndex, bank);

  function render() {
    scoreText.textContent = `${getScore(state)} / ${bank.length}`;
    container.innerHTML = "";

    state.order.forEach((bankIndex, renderIndex) => {
      const question = bank[bankIndex];
      const answerState = state.answers[renderIndex];
      const answerOrder = state.answerOrders[bankIndex] || [...Array(question.jawaban.length).keys()];

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

  resetBtn.addEventListener("click", () => {
    state = createState(bank);
    saveState(quizIndex, state);
    render();
  });

  render();
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