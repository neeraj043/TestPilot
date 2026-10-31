# TestPilot Quiz

A static, mobile-friendly Playwright and JavaScript knowledge assessment with Basic, Intermediate, Moderate, and Expert levels. Each attempt randomly selects six questions and downloads the latest `questions.json` from the server, so no database is required.

## Update questions

Edit `questions.json` on the server. Each question must include `level`, `category`, `question`, `options`, zero-based `answer`, and `explanation`. Optional `code` and `diagram` fields can add source-code or ASCII-diagram content.

## Run locally

Open `index.html` directly, or serve the folder:

```powershell
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Deploy online

Any static host works. Upload `index.html`, `styles.css`, `app.js`, and `questions.json` together to the same folder. For example, use `/quiz/` on stlabsindia.com and open `https://stlabsindia.com/quiz/`. The server must serve JSON with `application/json`. No PHP, database, Node server, or API key is required.

For GitHub Pages, push these files and select the repository root branch in **Settings → Pages**.
