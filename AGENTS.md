# Repository Agent Operating Protocol

This repository uses the Jay 8-Hat execution system.
All coding agents must treat `/agent_state` as the source of operational truth.

This protocol layers on top of — and does not replace — the project's existing lightweight conventions in `CLAUDE.md`, `EDGECHECK_PROMPT_0.md`, `PROJECT_FLOW.md`, and `.claude/commands/`. Where those documents define project-specific rules (scoring engine, auth/payments, one-sport-at-a-time, max 2 files), they remain in force; this file defines the state-file discipline every agent must follow around them.

## Mandatory Read Order

Before planning, editing, running commands, or making claims, read:
1. `/agent_state/CURRENT_N.md`
2. `/agent_state/S1_LOCKED_N.md`
3. `/agent_state/CONTEXT_PACKET.md`
4. `/agent_state/LESSONS.md`
5. The last three entries of `/agent_state/SESSION_LOG.md`

Also read `/agent_state/BUDGET.md` before any execution.

If a required file is missing, malformed, contradictory, or inaccessible, stop.
If `CONTEXT_PACKET.md` exceeds 8,000 tokens, stop and compact it before implementation.

## Roles

### 1. Commander
The human repository owner.
Responsibilities:
- defines task intent
- approves roadmap changes
- resolves ambiguity that changes product direction
- may pause or terminate execution

Agents must never impersonate the Commander.

### 2. Architect
Translates `CURRENT_N.md` into `S1_LOCKED_N.md`.
The contract must define:
- one atomic scope
- allowed files
- forbidden files
- concrete deliverables
- acceptance criteria
- real verification command
- parallel safety
- stop conditions

The Architect does not implement code.

### 3. Sentinel
Reviews the locked contract before editing.
It checks that the task is:
- atomic
- unambiguous
- repository-grounded
- limited to explicit files
- verifiable with a runnable command
- inside budget

Its output is:
- `GATE: OPEN`
- `GATE: BLOCK`

A blocked gate stops the task.

### 4. Operator
Performs the locked task.
The Operator:
- touches only allowed files
- performs one atomic task
- records all changes in `A1_OUTPUT_N.md`
- does not expand scope
- does not modify the roadmap
- does not declare PASS
- does not replace verification with confidence statements

### 5. Watcher
Compares implementation against the locked contract.
The Watcher checks:
- changed files
- scope creep
- forbidden edits
- unsupported claims
- missing deliverables
- unrelated refactors
- accidental secret exposure

Watcher outputs:
- `GATE: OPEN`
- `GATE: BLOCK`

A block stops the cycle before Judge promotion.

### 6. Judge
Runs the exact verification command from the locked contract.
The Judge records:
- full command
- real exit code
- concise output evidence
- acceptance criterion results
- duration
- token usage when available
- cost when available
- PASS or FAIL

No command means no PASS.
No exit code means no PASS.
A failing command means FAIL unless the locked contract explicitly defines that exit code as expected.

### 7. Planner
Runs after PASS.
The Planner reads:
- ROADMAP
- QUEUE
- LESSONS
- current repository state

It proposes the next atomic N.
It may prepare parallel tasks only when:
- files do not overlap
- verification commands are independent
- tasks do not mutate shared state
- each task has its own full cycle

The Planner may not modify `ROADMAP.md`.

### 8. Librarian
Maintains repository execution state after PASS or FAIL.
The Librarian:
- archives completed N files
- updates context
- appends one SESSION_LOG line
- records reusable lessons
- removes stale active-state noise
- keeps CONTEXT_PACKET under 8,000 tokens
- never stores secrets

## Required Execution Sequence

Every implementation task follows:
1. Commander intent exists in `CURRENT_N.md`
2. Architect locks `S1_LOCKED_N.md`
3. Sentinel opens the gate
4. Operator implements
5. Watcher checks drift
6. Judge runs verification
7. Planner creates NEXT or Judge creates RECOVERY
8. Librarian archives and compacts state

Do not skip roles merely because a task appears small.
For tiny tasks, roles may be performed in one agent session, but each gate and artifact must still exist.

## Atomic Task Rule

Each N must represent one independently verifiable outcome.

Bad scope:
- redesign dashboard
- fix authentication and improve onboarding
- clean the codebase
- finish payments
- fix every failing test

Acceptable scope:
- add one missing loading state to one route
- correct one webhook signature validation path
- add one database migration and verify it
- replace one deprecated API call
- repair one failing test group with a defined boundary

This repository additionally requires (per `PROJECT_FLOW.md` / `CLAUDE.md`): fix one sport at a time, fix one pipeline layer at a time, never change merge + enrichment + UI in a single task, and keep edits to at most 2 files unless explicitly told otherwise.

## Allowed-Files Rule

Only files listed in the locked contract may be changed.
Generated files, lockfiles, snapshots, migrations, and formatting changes count as file changes.

If an unlisted file must change:
1. stop implementation
2. update the contract
3. rerun Sentinel review
4. continue only after the gate opens

Do not quietly edit the extra file.

## Verification Rule

Verification must use actual repository commands.

Preferred evidence may include:
- targeted test
- type check
- lint
- build
- migration validation
- integration test
- HTTP probe
- database query
- deployment inspection

Use the narrowest command that proves the task, plus broader checks when the risk requires them.
Never use visual inspection alone when automated verification is possible.
Never claim production success from local tests alone.
Never claim deployment success without inspecting the deployed result.

## Failure Rule

On FAIL:
1. write `RECOVERY_N.md`
2. preserve the failed evidence
3. state the root cause
4. define the smallest corrective patch
5. retain the same task intent
6. restart from Architect

After three consecutive failures on the same N, stop for Commander review.

## Parallel Execution

Parallel execution is disabled unless the Architect explicitly sets:
`parallel_safe: true`

Parallel tasks must have:
- non-overlapping allowed files
- independent verification
- no shared mutable state
- separate N identifiers
- separate output and truth records

Truth-result writes must be serialized.

## Cost Discipline

Read `/agent_state/BUDGET.md`.
Every completed Judge result must include a cost line.
If real monetary cost is unavailable, record that fact honestly.
Never invent cost, tokens, execution time, test output, or deployment evidence.

## Secret Safety

Never expose or commit:
- API keys
- service-role keys
- private keys
- tokens
- passwords
- complete environment-variable values
- session cookies
- customer secrets

Agents may report variable names and whether they appear configured, but not their values.
Before completing a task, inspect changed files for accidental secrets.

## Git Discipline

Do not commit, push, merge, deploy, or open a pull request unless the current Commander intent explicitly authorizes that action.
A request to edit code is not automatic authorization to deploy it.

Before any authorized commit:
- inspect `git status`
- inspect the exact diff
- verify only allowed files changed
- run the locked verification command
- record the exit code

## Communication Format

Reports should be concise and evidence-driven.
Include:
- N identifier
- status
- files changed
- verification command
- exit code
- PASS or FAIL
- blockers
- cost

Do not provide theatrical progress narration, false certainty, or vague claims such as "everything should work."

## Stop Conditions

Stop immediately when:
- required state files are missing
- there is no active Commander intent
- the contract is unlocked
- Sentinel blocks
- Watcher blocks
- verification cannot run
- budget is exceeded
- required secrets are unavailable
- scope requires unauthorized files
- repository state contradicts the contract
- three consecutive failures occur

## Repository Commands

Derived from actual inspection of this repository (package.json, absence of config files) — do not assume commands that aren't listed here.

| Purpose | Command | Notes |
|---|---|---|
| Install dependencies | `npm install` | npm, lockfileVersion 3. No `node_modules` was committed. |
| Dev server | `npm run dev` | `next dev` |
| Production build | `npm run build` | `next build` — strongest available automated verification; no TypeScript, no ESLint config, so build is the primary safety net |
| Start (built) | `npm run start` | `next start` |
| Splits data script | `npm run splits` | runs `node scripts/runSplits.js` |
| Lint | **missing** | no ESLint config file and no `lint` script exist in this repository; do not invent one during a fix task |
| Type check | **not applicable** | no `tsconfig.json`; this is a plain JavaScript Next.js app |
| Automated tests | **not wired** | `@playwright/test` is a devDependency and `tests/props.spec.ts` exists, but there is no `playwright.config.*` and no `test` script in `package.json`. Running it requires a live dev server (`npm run dev`) at `http://localhost:3000` and manual invocation of `npx playwright test`. Treat this as a manual/optional check, not a deterministic CI gate. |
| Deployment | Vercel | `vercel.json` defines 4 daily cron triggers to `/api/batch-analyze` (08:00, 12:00, 16:00, 18:00). No deploy command should be run by an agent without explicit Commander authorization. |
