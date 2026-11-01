# TestPilot Quiz

A Playwright and JavaScript assessment that generates a fresh questionnaire at runtime through a server API.

## Run locally

```powershell
npm start
```

Then visit `http://localhost:8080`.

## Generate with AI

Set an OpenAI-compatible API key before starting the server:

```powershell
$env:OPENAI_API_KEY="your-api-key"
$env:OPENAI_MODEL="gpt-4o-mini"
npm start
```

Without an API key, the API uses its built-in runtime generator so local development still works. Override the provider endpoint with `OPENAI_BASE_URL` if needed.

## API

`POST /api/generate`

```json
{
  "level": "basic",
  "count": 6,
  "topic": "Playwright locators"
}
```

Supported levels are `basic`, `intermediate`, `moderate`, and `expert`.
