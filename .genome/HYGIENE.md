# HYGIENE — root cleanliness report

| Entry | Size MB | tracked | untracked | ignored | Verdict |
|---|---|---|---|---|---|
| node_modules | 1527.53 |  |  | ✓ | KEEP-IGNORED — deps |
| frontend | 1281.75 | ✓ |  | ✓ | KEEP-TRACKED — product source |
| data | 537.51 |  |  | ✓ | ASSESS — runtime data? |
| chrome-profiles | 411.57 |  |  | ✓ | KEEP-IGNORED — runtime browser profiles |
| .archive | 244.38 |  |  | ✓ | KEEP-IGNORED-OR-TRACKED — intent evidence — required by principal for mining |
| .cip | 136.24 |  | ✓ | ✓ | ASSESS — CIP tool state; track config, ignore reports/logs |
| src | 68.03 | ✓ | ✓ | ✓ | KEEP-TRACKED — product source |
| src-tauri | 60.62 | ✓ |  | ✓ | KEEP-TRACKED — desktop source |
| .kilo | 53.43 |  |  | ✓ | ASSESS — speckit/tool state |
| .opencode | 52.94 | ✓ |  | ✓ | KEEP-TRACKED — repo agent config (skills etc.) |
| scripts | 43.48 | ✓ |  | ✓ | KEEP-TRACKED — tooling |
| prisma | 27.76 | ✓ |  | ✓ | KEEP-TRACKED — schema source |
| tests | 15.62 | ✓ |  |  | KEEP-TRACKED — tests |
| seeds | 13.93 | ✓ |  | ✓ | KEEP-TRACKED — seed truth |
| snapshots | 11.73 |  | ✓ |  | ASSESS — screenshots — archive or ignore |
| .genome | 3.57 |  | ✓ |  | KEEP-TRACKED — our evidence artifacts (canon) |
| devops | 2.14 | ✓ |  |  | KEEP-TRACKED — tooling |
| context-pack-md | 0.77 | ✓ |  |  | KEEP-TRACKED — context pack source |
| docs | 0.47 | ✓ | ✓ | ✓ | KEEP-TRACKED — docs (gitignore conflict must be fixed) |
| intelligence-pack-acu-dcb-storage | 0.36 | ✓ |  |  | ASSESS — unverified directory |
| package-lock.json | 0.22 |  |  | ✓ | ASSESS — unclassified |
| context-pack.zip | 0.21 | ✓ |  |  | PROPOSE-REMOVE — duplicate of context-pack-md/ (generated archive) |
| bun.lock | 0.17 | ✓ |  |  | ASSESS — unclassified |
| prd-merged | 0.12 | ✓ |  |  | KEEP-TRACKED — PRD records |
| AGENTS.md | 0.05 | ✓ |  |  | ASSESS — unclassified |
| .runtime | 0.04 |  |  | ✓ | KEEP-IGNORED — runtime state |
| CHANGELOG.md | 0.04 | ✓ |  |  | ASSESS — unclassified |
| claude-investigate | 0.03 | ✓ |  |  | ASSESS — dev signals dir |
| shared | 0.03 | ✓ |  |  | KEEP-TRACKED — shared source |
| IMPLEMENTATION_PLAN_PHASE6.md | 0.02 | ✓ |  |  | ASSESS — unclassified |
| .devin | 0.01 | ✓ |  |  | ASSESS — devin config |
| .github | 0.01 | ✓ |  |  | KEEP-TRACKED — CI config |
| CODE_OF_CONDUCT.md | 0.01 | ✓ |  |  | ASSESS — unclassified |
| CONTRIBUTING.md | 0.01 | ✓ |  |  | ASSESS — unclassified |
| README.md | 0.01 | ✓ |  |  | ASSESS — unclassified |
| sdk | 0.01 | ✓ |  |  | KEEP-TRACKED — source |
| .backups | 0 |  |  |  | ASSESS — backups — verify not needed for recovery |
| .env | 0 | ✓ |  |  | KEEP-IGNORED — secrets |
| .env.example | 0 | ✓ |  |  | KEEP-TRACKED — env template |
| .gitattributes | 0 | ✓ |  |  | ASSESS — unclassified |
| .gitignore | 0 | ✓ |  |  | ASSESS — unclassified |
| .taurignore | 0 | ✓ |  |  | ASSESS — unclassified |
| .test-tmp | 0 |  |  |  | PROPOSE-REMOVE — test scratch |
| biome.json | 0 | ✓ |  |  | ASSESS — unclassified |
| bun.test.config.ts | 0 | ✓ |  |  | ASSESS — unclassified |
| bunfig.toml | 0 | ✓ |  |  | ASSESS — unclassified |
| lefthook.yml | 0 | ✓ |  |  | ASSESS — unclassified |
| LICENSE | 0 | ✓ |  |  | ASSESS — unclassified |
| opencode.json | 0 | ✓ |  |  | ASSESS — unclassified |
| package.json | 0 | ✓ |  |  | ASSESS — unclassified |
| SECURITY.md | 0 | ✓ |  |  | ASSESS — unclassified |
| specs | 0 |  |  |  | ASSESS — unclassified |
| tsconfig.json | 0 | ✓ |  |  | ASSESS — unclassified |
| tsconfig.verify.json | 0 | ✓ |  |  | ASSESS — unclassified |
| tsup.config.ts | 0 | ✓ |  |  | ASSESS — unclassified |
| _repro2_stream_parser.ts | 0 | ✓ |  |  | ASSESS — unclassified |

## Gitignore issues
- none

## Proposed actions (principal approves)
- REMOVE files: only listed above as PROPOSE-REMOVE — never executed automatically
- .gitignore additions: src/generated/ (dry-run — rerun with --apply)