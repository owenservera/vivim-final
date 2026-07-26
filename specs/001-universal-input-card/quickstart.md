# Quickstart: Validating the Atomic Input Box

## Prerequisites

- Backend running on port 9420
- Frontend dev server running (`cd frontend && bun run dev`)
- At least one provider seeded (gemini, chatgpt, or claude)

## Quick Test Flow

```bash
# 1. Verify backend is up and an active conversation exists
bun run devops runtime-test discover-backend

# 2. Check the frontend renders the new TextEntryBox
#    After implementing, navigate to http://localhost:3000
#    The composer should show only textarea + send button (no model pill, no chips)
```

## Manual Test Cases

### Test 1: Minimal rendering
1. Open the app
2. **Expect**: Only a textarea with placeholder "Message..." and a Send button
3. **Pass**: No model selector, no chips, no footer, no quote bar, no streaming bar

### Test 2: Send a message
1. Type "hello world" in the textarea
2. Press Enter
3. **Expect**: Message appears in the thread, textarea clears

### Test 3: Shift+Enter for newlines
1. Type "line 1", press Shift+Enter, type "line 2"
2. Press Enter
3. **Expect**: Message contains both lines with `\n` between them

### Test 4: Empty send is disabled
1. Textarea is empty
2. **Expect**: Send button is disabled (grey, non-clickable)

### Test 5: Toggle add-ons
1. Click gear icon
2. Check "Model Selector" — a model pill appears above textarea
3. Uncheck "Model Selector" — model pill disappears
4. Reload the page — model pill reappears (persisted)

### Test 6: Streaming bar
1. Send a message
2. **Expect**: A streaming status bar appears with pulsing red dot, "Streaming..." text, and Stop button
3. Wait for response — bar disappears
4. **Or** click Stop — bar disappears immediately

## Possible Failure Modes

| Symptom | Likely Cause | Diagnosis |
|---------|--------------|-----------|
| No composer at all | `ComposerShell` import path wrong | Check browser console for module resolution errors |
| Add-ons toggle but don't render | Add-on Component not exported from registry index | Check `BUILTIN_ADDONS` entries |
| Model selector shows loading forever | Provider models fetch failing | Check `/api/providers/:id` returns models |
| Send does nothing | Behavior dispatch not wired | Check `ComposerShell` calls the right `handleSubmit` path |
| Streaming bar never appears | isStreaming state not set on submit | Check `submit` sets `setIsStreaming(true)` before fetch |
| Gear menu doesn't persist after reload | localStorage key format wrong | Check key matches `vivim:composer-addons:{instanceId}` |
