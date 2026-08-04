# PRD #5: Form Validation

## Problem Statement

Forms across the app lack consistent validation:
- No real-time field validation (errors only shown on submit, or not at all)
- No visual feedback for valid/invalid fields (no red borders, no checkmarks)
- No inline help text below fields
- No form-level error summary
- Inconsistent required field marking (some use `*`, some don't)
- No password strength indicator
- No email format validation

## Existing Code Assessment

| Component | Location | Status |
|-----------|----------|--------|
| `form.tsx` | `components/ui/form.tsx` | **Exists but UNUSED** — Full react-hook-form integration: `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`. Uses Radix Label, `aria-invalid`, `aria-describedby`. Has `useFormField` hook for field state. |
| `input.tsx` | `components/ui/input.tsx` | **Exists** — Tailwind-based input with `aria-invalid:ring-destructive` styling. Focus ring, disabled state. |
| `label.tsx` | `components/ui/label.tsx` | **Exists** — Radix LabelPrimitive wrapper. |
| `SessionControls.tsx` | `components/canvas/SessionControls.tsx` | **Login form** — raw state (`email`, `password`), no validation, just `!email.trim() || !password.trim()` check on submit. Uses `InputField` (canvas custom), NOT the `form.tsx` system. |
| `WorkspaceSettings.tsx` | `components/chat/WorkspaceSettings.tsx` | **Settings form** — raw state, no validation. Uses inline `InputField` components. Save disabled only when `saving` is true. |
| `Toolbar.tsx` | `components/builder/Toolbar.tsx` | **Builder toolbar** — raw `type="text"` inputs, no validation. |

**Key gap:** The `form.tsx` component library (react-hook-form + Zod-ready) exists but is **not imported anywhere**. All actual forms use raw `useState` + custom `InputField` with zero validation.

## Goals

1. **Real-time validation** — validate on blur, show errors immediately
2. **Visual feedback** — red border + icon for invalid, green checkmark for valid
3. **Inline help text** — helper text below fields, error messages below that
4. **Required field marking** — consistent `*` with screen reader text
5. **Form-level error summary** — collapsible error list at top of form
6. **Password strength** — visual strength meter for password fields

## Scope

| Area | Files | Action | Existing? |
|------|-------|--------|-----------|
| Adopt existing form system | `form.tsx` | Wire react-hook-form + Zod into actual forms (SessionControls, WorkspaceSettings) | ⚠️ Exists but unused |
| Zod schemas | `schema/forms.ts` (new) | Define validation schemas for login, settings, etc. | ❌ Missing |
| Validated field wrapper | `components/ui/ValidatedField.tsx` | Convenience wrapper combining Input + FormField + error display | ❌ Missing (form.tsx primitives exist) |
| Error summary | `components/ui/FormErrorSummary.tsx` | Collapsible list of all form errors | ❌ Missing |
| Password strength | `components/ui/PasswordStrength.tsx` | Visual strength meter (weak/fair/strong/very strong) | ❌ Missing |
| CSS tokens | `globals.css` | Add `--color-error`, `--color-success` tokens, validation shake animation | ⚠️ Partial (`--destructive` exists) |
| Refactor login form | `SessionControls.tsx` | Migrate from raw state to react-hook-form + Zod | ⚠️ Modify |
| Refactor settings form | `WorkspaceSettings.tsx` | Migrate from raw state to react-hook-form + Zod | ⚠️ Modify |

## Non-Goals

- Multi-step wizard forms (covered by Area 9 Provider Setup)
- Dynamic form generation from schema
- File upload validation

## Implementation Steps

### Step 1: Zod validation schemas
Create `schema/forms.ts` — define `loginSchema`, `workspaceSettingsSchema` with Zod. Include email format, password min length, required fields.

### Step 2: Adopt form.tsx in SessionControls
Migrate `SessionControls.tsx` login form from raw state to `Form` + `FormField` + `FormItem` + `FormLabel` + `FormControl` + `FormMessage`. Wire Zod schema via `zodResolver`.

### Step 3: Validated field component
Create `components/ui/ValidatedField.tsx` — convenience wrapper: label + input + help text + error message + valid/invalid icon (checkmark/X).

### Step 4: Error summary
Create `components/ui/FormErrorSummary.tsx` — reads form errors from `useFormState`, renders collapsible list with click-to-focus.

### Step 5: Password strength
Create `components/ui/PasswordStrength.tsx` — visual bar (weak/fair/strong/very strong) based on length + complexity.

### Step 6: Adopt form.tsx in WorkspaceSettings
Migrate `WorkspaceSettings.tsx` from raw state to react-hook-form + Zod.

### Step 7: CSS tokens
Add `--color-error`, `--color-success` to `globals.css`. Add shake animation for invalid submission attempts.

## Acceptance Criteria

- [ ] Fields validate on blur (not just on submit)
- [ ] Invalid fields show red border + error message
- [ ] Valid fields show green checkmark
- [ ] Help text appears below fields
- [ ] Form-level error summary shows all errors
- [ ] Password strength meter shows weak/fair/strong/very strong
- [ ] Required fields marked with `*` and screen reader text
- [ ] Login form uses react-hook-form + Zod (migrated from raw state)
- [ ] Settings form uses react-hook-form + Zod (migrated from raw state)
- [ ] `bun run typecheck` passes
- [ ] `bun run build` succeeds

## Priority

**P1** — Improves form usability across all forms.

## Estimated Effort

~4–5 hours. Schema creation + form migration + new components + CSS.
