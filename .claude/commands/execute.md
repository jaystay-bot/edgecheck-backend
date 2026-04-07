Run the full 3-role workflow: Opender → Clauder → Truth.

GOAL:
Solve the task with a clear plan, minimal fix, and real UI verification.

---

STEP 1 — OPENDER (PLAN)

Define:
- TASK
- ISSUE
- SCOPE (max 2–4 files)
- SUCCESS
- VERIFY

Keep it tight. No overbuilding.

---

STEP 2 — CLAUDER (BUILD)

- Implement the smallest possible fix
- Do not expand scope
- Do not refactor unrelated code

Return:
- what was wrong
- what was changed
- why it works

---

STEP 3 — TRUTH (VERIFY WITH PLAYWRIGHT)

If UI is involved:
- open the app (localhost or deployed)
- navigate to the relevant page
- interact if needed (click tabs, etc.)
- confirm what the user actually sees

Return:
- PASS or FAIL
- what was checked
- what is broken (if any)

---

FINAL OUTPUT

- what was wrong
- what was changed
- why it works
- Truth result (PASS / FAIL)
- next action:
  - commit/push/deploy
  - or fix remaining issue

---

RULES

- Max 4 files unless required
- No redesign unless asked
- No guessing
- Stop after task is complete