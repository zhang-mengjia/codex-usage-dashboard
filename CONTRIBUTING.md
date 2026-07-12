# Contributing

Thanks for helping improve Codex Usage Dashboard.

## Before opening an issue

- Search existing issues first.
- Include the dashboard version, Windows version, and ChatGPT/Codex desktop version.
- Describe the expected and actual behavior and provide reproducible steps.
- Remove email addresses, conversation titles, account IDs, tokens, and other private information from screenshots and logs.
- Use [SECURITY.md](SECURITY.md) instead of a public issue for vulnerabilities.

## Local development

Requirements:

- Windows 10/11 x64
- Node.js 22+
- A signed-in ChatGPT/Codex installation for live integration tests

```powershell
npm ci
npm test
npm start
```

`npm test` is self-contained. `npm run test:live` talks to the local ChatGPT/Codex environment and may fail when the official app is not installed, signed in, or compatible.

## Pull requests

1. Create a focused branch.
2. Keep changes scoped to one problem or feature.
3. Add or update tests for behavior changes.
4. Run `npm test`; for integration changes also run `npm run test:live` and the packaged smoke test when possible.
5. Explain user-visible impact and any remaining limitations in the pull request.

Do not commit `node_modules/`, `release/`, `test-results/`, local credentials, account data, or real conversation data.
