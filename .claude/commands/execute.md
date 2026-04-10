Run the full 3-role workflow: Opender → Clauder → Truth.

GOAL:
Solve the task with a clear plan, minimal fix, and real verification.

---

STEP 1 — OPENDER (PLAN)

Define:
- TASK
- ISSUE
- SCOPE (max 2–4 files)
- SUCCESS
- VERIFY

Rules:
- Identify ONE exact root cause
- No guessing
- No multiple solutions
- No code edits

Keep it tight. No overbuilding.

---

STEP 2 — CLAUDER (BUILD)

- Implement the smallest possible fix
- Stay within defined scope
- Max 2 files unless required
- Do not refactor unrelated code
- Do not expand scope
- Do not commit / push / deploy

After fix:
- run type-check or relevant test (if exists)
- verify the touched logic works locally

Stop after fix.

---

STEP 3 — TRUTH (VERIFY WITH PLAYWRIGHT / CURL)

Use only if real verification is needed.

If UI:
- open app (localhost first, deployed if required)
- go to affected page
- interact only if needed
- confirm actual user-visible result

If API:
- hit endpoint with curl or minimal request
- confirm real response

Rules:
- Do NOT modify code
- Do NOT debug new issues
- Do NOT expand scope

---

FINAL OUTPUT

- what was wrong
- what was changed
- why it works
- Truth result (PASS / FAIL)
- remaining issue (if FAIL only)

---

RULES

- Max 4 files unless required
- No redesign unless asked
- No guessing
- Stop after task is complete
FAIL-FAST RULE:
- If the first direct check returns a 500 or runtime error, stop.
- Do not retry with alternate shell commands.
- Do not loop on curl or parsing attempts.
- Report the first observed failure and ask for the next instruct
STOP RULE:
- After the first successful direct check, stop.
- Do not run additional curl, shell, or retry commands.
- Do not verify more thoroughly.
- Return the result immediately. SUCCESS RULE: - One successful localhost response or one confirmed browser load is enough. - Do not perform secondary confirmation checks unless explicitly requested.