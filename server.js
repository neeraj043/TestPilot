'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const API_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions';

const allowedLevels = ['basic', 'intermediate', 'moderate', 'expert'];
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'
};

const topicTemplates = {
  basic: [
    ['locator API', 'Which Playwright method is commonly used to locate an element by a stable CSS selector?', ['page.locator()', 'page.waitFor()', 'page.route()', 'page.keyboard()'], 0, 'locator() creates a locator that can find and interact with the element.'],
    ['navigation', 'Which method waits for navigation caused by a click?', ['page.clickAndWait()', 'Promise.all([page.waitForNavigation(), page.click()])', 'page.wait(3000)', 'page.goto() only'], 1, 'Waiting for navigation and the click together avoids a race condition.'],
    ['assertions', 'Which Playwright assertion checks that an element is visible?', ['expect(locator).toBeEnabled()', 'expect(locator).toBeVisible()', 'expect(locator).toHaveURL()', 'expect(locator).toContainText()'], 1, 'toBeVisible() verifies that the locator resolves to a visible element.'],
    ['JavaScript', 'Which keyword declares a block-scoped variable that can be reassigned?', ['var', 'let', 'const', 'static'], 1, 'let is block-scoped and permits reassignment.']
  ],
  intermediate: [
    ['async JavaScript', 'What happens when await is used with a Promise that rejects?', ['It is converted to resolve()', 'The async function throws and must be handled or caught', 'Execution pauses forever', 'The rejection is automatically retried'], 1, 'Await throws the Promise rejection into the surrounding async control flow.'],
    ['network', 'How can a Playwright test intercept an HTTP request?', ['page.on()', 'page.route()', 'page.listen()', 'page.intercept()'], 1, 'page.route() registers a handler that can observe, fulfill, or continue requests.'],
    ['locators', 'Which locator chain finds the submit button inside a login form?', ['page.getByRole("form")', 'page.locator("form", { has: page.getByRole("button", { name: "Submit" }) })', 'page.locator("button")', 'page.getByText("Submit")'], 1, 'The has option filters an ancestor or container based on a matching descendant.']
  ],
  moderate: [
    ['debugging', 'A test intermittently fails because the page has not finished loading. What is the best fix?', ['Add a longer fixed sleep before every action', 'Wait for the specific UI state using a Playwright assertion or locator action', 'Disable timeout checks', 'Use page.evaluate() for the assertion'], 1, 'Waiting for a specific observable state is faster and less flaky than fixed delays.'],
    ['parallelism', 'What is a safe way to isolate state between Playwright workers?', ['Share a single browser storage context', 'Give each worker its own browser context and test data', 'Reuse the same logged-in session', 'Run every test serially only'], 1, 'Independent contexts prevent cookies, storage, and application state from leaking between workers.']
  ],
  expert: [
    ['fixtures', 'Which approach is best for reusable authenticated state across Playwright tests?', ['Create credentials inside every test', 'Use a scoped fixture plus storageState setup', 'Disable authentication in production', 'Call page.reload() repeatedly'], 1, 'Fixtures encapsulate setup, while storageState can restore an authenticated browser context efficiently.'],
    ['flakiness', 'How should a test handle a third-party service that is unavailable during CI?', ['Replace it with a route fixture that models required responses', 'Retry indefinitely', 'Remove the test', 'Use a fixed 30-second timeout'], 0, 'Controlled API mocking keeps the application behavior deterministic while testing the integration boundary.']
  ]
};

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function localGenerate(level, count, topic) {
  const pools = shuffle(topicTemplates[level] || topicTemplates.basic);
  const prepared = [];
  for (let i = 0; i < count; i++) {
    const template = pools[i % pools.length];
    const suffix = i >= pools.length ? ` Scenario ${Math.floor(i / pools.length) + 1}.` : '';
    prepared.push({
      level,
      category: topic ? `${template[0]} • ${topic}` : template[0],
      question: template[1] + suffix,
      options: [...template[2]],
      answer: template[3],
      explanation: template[4]
    });
  }
  return prepared;
}

async function aiGenerate(level, count, topic) {
  const prompt = `Generate exactly ${count} unique multiple-choice questions for a Playwright and JavaScript assessment at ${level} level${topic ? ` about ${topic}` : ''}. Return only valid JSON as an array. Each item must have: level (exactly "${level}"), category (string), question (string), options (array of exactly 4 strings), answer (integer index 0-3), explanation (string). Avoid markdown and duplicate questions.`;
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: MODEL, temperature: 0.8, messages: [{ role: 'system', content: 'You create accurate technical quiz questions. Return only JSON.' }, { role: 'user', content: prompt }] })
  });
  if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
  const payload = await response.json();
  const text = payload.choices?.[0]?.message?.content || '';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const questions = JSON.parse(cleaned);
  return questions.filter(q => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answer)).slice(0, count);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = '';
    request.on('data', chunk => { data += chunk; if (data.length > 100000) { reject(new Error('Request body too large')); request.destroy(); } });
    request.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('Invalid JSON body')); } });
  });
}

async function handleGenerate(request, response) {
  try {
    const body = await readJson(request);
    const level = String(body.level || 'basic').toLowerCase();
    const count = Math.min(20, Math.max(1, Number.parseInt(body.count, 10) || 6));
    const topic = String(body.topic || '').slice(0, 100);
    if (!allowedLevels.includes(level)) throw new Error(`Level must be one of: ${allowedLevels.join(', ')}`);
    let questions = API_KEY ? await aiGenerate(level, count, topic) : localGenerate(level, count, topic);
    if (questions.length < count) questions = [...questions, ...localGenerate(level, count - questions.length, topic)].slice(0, count);
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ questions, generatedAt: new Date().toISOString(), source: API_KEY ? 'ai' : 'runtime-generator' }));
  } catch (error) {
    response.writeHead(error.message.includes('AI provider') ? 502 : 400, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: error.message }));
  }
}

const server = http.createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  if (pathname === '/api/generate' && request.method === 'POST') return handleGenerate(request, response);
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405); return response.end('Method Not Allowed'); }

  let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relativePath);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) { response.writeHead(403); return response.end('Forbidden'); }
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) { response.writeHead(404); return response.end('Not found'); }
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    if (request.method === 'HEAD') return response.end();
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(PORT, () => console.log(`TestPilot API running at http://localhost:${PORT}`));
