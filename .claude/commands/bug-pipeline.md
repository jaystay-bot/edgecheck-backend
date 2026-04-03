Analyze and fix this bug: $ARGUMENTS

Process:
1. Use Codex first for analysis only.
2. Codex returns exactly:
   - FILE: [exact file path]
   - LINE/FUNCTION: [exact failing line or function]
   - ROOT CAUSE: [one clear cause]
3. Codex must not edit code.
4. Claude Code then applies the smallest possible fix.
5. Claude returns:
   - what was wrong
   - what file(s) changed
   - why it works

Rules:
- one task per run
- no refactor unless explicitly requested
- stop after the fix
- if Codex returns multiple possible causes, rerun analysis until one exact root cause is identified
