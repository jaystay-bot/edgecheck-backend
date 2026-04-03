Read the current working context before any code changes.

Use Codex to:
- read the file related to: $ARGUMENTS
- read any directly connected files
- check the last git commit message
- check current terminal errors if present

Return a clean snapshot:
- FILE: main file
- RELATED FILES: short list
- CURRENT STATE: what the code is doing now
- LAST CHANGE: last commit summary
- ISSUES: any visible errors or risks

Do not edit code.

Stop after returning the snapshot.
