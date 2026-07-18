# Plan: Gemini Full Webapp Tooling

## Steps
1. Discover protocol: `bun run devops discover-protocol https://gemini.google.com --hint=gemini`
2. Infer parser: `bun run devops onboard infer --provider=gemini`
3. Seed provider + endpoints JSON in `seeds/providers/gemini.json`; `bun run db:seed`
4. Register capability `cap:gemini:send` with surfaces cli/ui/api/mcp in `capability-bootstrap.ts`
5. Build RichTextParse engine for all text types (LaTeX/tables/code/links/markdown/lists/indent)
6. Frontend: ChatPage composer (image receive + file send) + canvas layer
7. Verify: `onboard test-selectors` → `onboard test-parse` → `onboard test-frontend` → `onboard verify`
8. Gate: typecheck + lint + bun test + audit-code standard
9. Converge + stop
