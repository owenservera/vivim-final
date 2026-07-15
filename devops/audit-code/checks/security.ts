// devops/audit-code/checks/security.ts
// Security dimension: secret leakage + injection at boundaries.

import { buildFinding, type Finding } from '../findings.ts'
import { PROJECT_ROOT, SRC_DIRS, scanForPattern } from '../scan.ts'

const SECRET_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /(?:api[_-]?key|secret|token|passwd|password)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/i, label: 'hardcoded secret/key assignment' },
  { re: /-----BEGIN\s+(?:RSA|EC|OPENSSH|PGP)?\s*PRIVATE KEY-----/, label: 'embedded private key' },
  { re: /sk-[A-Za-z0-9]{20,}/, label: 'OpenAI-style secret key' },
  { re: /AKIA[0-9A-Z]{16}/, label: 'AWS access key id' },
  { re: /ghp_[A-Za-z0-9]{20,}/, label: 'GitHub personal access token' },
]

// eval() is unambiguously dangerous -> P0. new Function() is a legitimate
// pattern in expression/DSL compilers but risky if fed untrusted input -> P1.
// Shell exec is only flagged for real child_process usage, not arbitrary
// `.spawn()` method calls -> P0/P1.
const EVAL_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\beval\s*\(/, label: 'eval() on potentially-untrusted input' },
]
const NEW_FN_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\bnew\s+Function\s*\(/, label: 'new Function() — verify the expression source is trusted' },
]
const SHELL_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(?:execSync|execFileSync)\s*\(/, label: 'synchronous shell exec — verify input is validated' },
  { re: /\bchild_process\.(?:exec|spawn|execFile)\s*\(/, label: 'child_process call — verify input is validated' },
]

export async function checkSecurity(): Promise<Finding[]> {
  const out: Finding[] = []

  for (const { re, label } of SECRET_PATTERNS) {
    const matches = await scanForPattern(PROJECT_ROOT, SRC_DIRS, re, ['seed.sql'])
    for (const m of matches) {
      out.push(
        buildFinding({
          priority: 'P0',
          dimension: 'security',
          title: `Secret leakage: ${label}`,
          description: `A pattern matching ${label} was found in source. Secrets must come from the environment / ConfigManager, never be committed.`,
          file: m.rel,
          line: m.line,
          evidence: m.text,
          impact: 'Credential compromise; attackers can reach external systems or data.',
          fixSummary: 'Move the value to an environment variable resolved via ConfigManager.',
          fixSteps: [
            'Remove the literal secret from source.',
            'Add the key name to ConfigManager (or .env with a placeholder).',
            'Reference it at runtime: config.get("KEY_NAME").',
            'Rotate the leaked credential immediately.',
          ],
          effort: 'S',
          autoFixable: false,
        }),
      )
    }
  }

  // eval() -> P0
  for (const { re, label } of EVAL_PATTERNS) {
    const matches = await scanForPattern(PROJECT_ROOT, ['src'], re)
    for (const m of matches) {
      out.push(
        buildFinding({
          priority: 'P0',
          dimension: 'security',
          title: `Injection risk: ${label}`,
          description: 'Dynamic evaluation detected. If the argument can be influenced by untrusted input this is a code-injection vector.',
          file: m.rel,
          line: m.line,
          evidence: m.text,
          impact: 'Arbitrary code execution if input is attacker-controlled.',
          fixSummary: 'Validate and whitelist inputs, or replace with a safe typed API.',
          fixSteps: [
            'Identify the input source for the evaluated value.',
            'If untrusted, validate against a strict allow-list or schema.',
            'Prefer a typed API over eval where possible.',
          ],
          effort: 'M',
          autoFixable: false,
        }),
      )
    }
  }

  // new Function() -> P1 (legitimate in DSL/expression compilers)
  for (const { re, label } of NEW_FN_PATTERNS) {
    const matches = await scanForPattern(PROJECT_ROOT, ['src'], re)
    for (const m of matches) {
      out.push(
        buildFinding({
          priority: 'P1',
          dimension: 'security',
          title: `Dynamic evaluation: ${label}`,
          description: 'new Function() compiles code at runtime. Safe only when the expression is fully trusted (e.g. a static DSL).',
          file: m.rel,
          line: m.line,
          evidence: m.text,
          impact: 'Code execution if the compiled expression derives from untrusted input.',
          fixSummary: 'Confirm the expression source is trusted; otherwise validate or sandbox it.',
          fixSteps: [
            'Trace where the expression string originates.',
            'If user-influenced, validate against an allow-list or use a sandboxed evaluator.',
          ],
          effort: 'M',
          autoFixable: false,
        }),
      )
    }
  }

  // real shell exec -> P0/P1
  for (const { re, label } of SHELL_PATTERNS) {
    const matches = await scanForPattern(PROJECT_ROOT, ['src'], re)
    for (const m of matches) {
      out.push(
        buildFinding({
          priority: 'P0',
          dimension: 'security',
          title: `Injection risk: ${label}`,
          description: 'Process execution detected. If any argument can be influenced by untrusted input this is a command-injection vector.',
          file: m.rel,
          line: m.line,
          evidence: m.text,
          impact: 'Arbitrary command execution if input is attacker-controlled.',
          fixSummary: 'Validate and whitelist inputs, or replace with a safe typed API.',
          fixSteps: [
            'Identify the input source for the executed command/args.',
            'If untrusted, validate against a strict allow-list or schema.',
            'Prefer a typed API over shelling out where possible.',
          ],
          effort: 'M',
          autoFixable: false,
        }),
      )
    }
  }

  return out
}
