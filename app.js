let allQuestions = [];
let questions = [];
let selectedLevel = 'basic';
let index = 0;
let score = 0;
let correct = 0;
let answered = 0;
let selected = false;
let seconds = 90;
let timerId;

const $ = id => document.getElementById(id);
const startScreen = $('startScreen');
const quizScreen = $('quizScreen');
const resultsScreen = $('resultsScreen');

async function generateQuestions() {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level: selectedLevel, count: 6 })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Question generation failed (${response.status})`);
  }
  const result = await response.json();
  return result.questions;
}

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function startQuiz() {
  const button = $('startButton');
  button.disabled = true;
  button.innerHTML = 'Loading fresh questions…';
  try {
    const generatedQuestions = await generateQuestions();
    if (!generatedQuestions.length) throw new Error(`No ${selectedLevel} questions could be generated`);

    questions = shuffled(generatedQuestions).slice(0, Math.min(6, generatedQuestions.length));
    index = 0; score = 0; correct = 0; answered = 0;
    startScreen.classList.add('hidden'); resultsScreen.classList.add('hidden'); quizScreen.classList.remove('hidden');
    $('questionCounter').textContent = '';
    renderQuestion();
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = 'Start assessment <span>→</span>';
  }
}

function renderQuestion() {
  selected = false;
  seconds = 90;
  clearInterval(timerId);
  updateTimer();
  timerId = setInterval(() => { seconds--; updateTimer(); if (seconds <= 0) handleTimeout(); }, 1000);

  const q = questions[index];
  $('questionCounter').textContent = `Question ${index + 1} of ${questions.length}`;
  $('questionKicker').textContent = `${selectedLevel.toUpperCase()} • ${q.category}`;
  $('questionTitle').textContent = q.question;
  $('progressFill').style.width = `${(index / questions.length) * 100}%`;
  $('liveScore').textContent = score;
  $('correctCount').textContent = correct;
  $('answeredCount').textContent = answered;
  $('nextButton').disabled = true;
  $('nextButton').innerHTML = index === questions.length - 1 ? 'See results <span>→</span>' : 'Next question <span>→</span>';
  $('feedback').className = 'feedback hidden';

  const diagram = $('diagram');
  diagram.classList.add('hidden');
  diagram.innerHTML = '';
  if (q.diagram || q.code) {
    diagram.classList.remove('hidden');
    diagram.innerHTML = `<pre>${escapeHtml(q.diagram || q.code)}</pre>`;
  }

  $('options').innerHTML = q.options.map((option, i) => `
    <button class="option" data-index="${i}">
      <span class="option-letter">${String.fromCharCode(65 + i)}</span>
      <span>${escapeHtml(option)}</span><span class="option-mark"></span>
    </button>`).join('');
  document.querySelectorAll('.option').forEach(button => button.addEventListener('click', chooseAnswer));
}

function chooseAnswer(event) {
  if (selected) return;
  selected = true; answered++;
  clearInterval(timerId);
  const buttons = [...document.querySelectorAll('.option')];
  const chosen = Number(event.currentTarget.dataset.index);
  const q = questions[index];
  buttons.forEach(button => button.disabled = true);

  if (chosen === q.answer) {
    event.currentTarget.classList.add('correct');
    event.currentTarget.querySelector('.option-mark').textContent = '✓';
    correct++; score += 10 + Math.max(0, seconds);
  } else {
    event.currentTarget.classList.add('wrong');
    event.currentTarget.querySelector('.option-mark').textContent = '×';
    buttons[q.answer].classList.add('correct');
    buttons[q.answer].querySelector('.option-mark').textContent = '✓';
  }
  const feedback = $('feedback');
  feedback.textContent = `${chosen === q.answer ? 'Correct. ' : 'Not quite. '}${q.explanation}`;
  feedback.className = `feedback ${chosen === q.answer ? '' : 'wrong-feedback'}`;
  $('liveScore').textContent = score;
  $('correctCount').textContent = correct;
  $('answeredCount').textContent = answered;
  $('nextButton').disabled = false;
}

function handleTimeout() {
  if (selected) return;
  answered++; selected = true; clearInterval(timerId);
  const buttons = [...document.querySelectorAll('.option')];
  buttons.forEach(button => button.disabled = true);
  buttons[questions[index].answer].classList.add('correct');
  buttons[questions[index].answer].querySelector('.option-mark').textContent = '✓';
  const feedback = $('feedback');
  feedback.textContent = `Time's up. ${questions[index].explanation}`;
  feedback.className = 'feedback wrong-feedback';
  $('answeredCount').textContent = answered;
  $('nextButton').disabled = false;
}

function updateTimer() {
  const minutes = String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0');
  const secs = String(Math.max(0, seconds) % 60).padStart(2, '0');
  $('timer').textContent = `${minutes}:${secs}`;
}

function nextQuestion() {
  if (index < questions.length - 1) { index++; renderQuestion(); }
  else finishQuiz();
}

function finishQuiz() {
  clearInterval(timerId);
  quizScreen.classList.add('hidden'); resultsScreen.classList.remove('hidden');
  const percentage = Math.round((correct / questions.length) * 100);
  $('finalScore').textContent = `${percentage}%`;
  $('resultCorrect').textContent = `${correct}/${questions.length}`;
  $('resultAccuracy').textContent = `${percentage}%`;
  $('resultAnswered').textContent = answered;
  $('resultMessage').textContent = percentage >= 80 ? 'Excellent work. You have a strong testing foundation and are ready for tougher scenarios.' : percentage >= 60 ? 'Good progress. Review the explanations you missed, then give it another run.' : 'Keep practicing. Focus on locators, async JavaScript, and Playwright waiting behavior.';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' })[char]);
}

document.querySelectorAll('.level-card').forEach(card => {
  card.addEventListener('click', () => {
    selectedLevel = card.dataset.level;
    document.querySelectorAll('.level-card').forEach(option => {
      const active = option === card;
      option.classList.toggle('active', active);
      option.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    $('questionCount').textContent = '6 fresh questions';
  });
});

$('startButton').addEventListener('click', startQuiz);
$('nextButton').addEventListener('click', nextQuestion);
$('restartButton').addEventListener('click', startQuiz);
$('exitButton').addEventListener('click', () => { clearInterval(timerId); quizScreen.classList.add('hidden'); startScreen.classList.remove('hidden'); });
$('themeButton').addEventListener('click', () => document.body.classList.toggle('light'));
