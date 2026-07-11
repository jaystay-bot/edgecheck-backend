# Execution Budget
max_Ns_per_run: 20
max_parallel_Ns: 3
max_cost_per_N_usd: 1.00
max_cost_per_run_usd: 20.00
max_hours_per_run: 4
checkpoint_interval_Ns: 5
max_consecutive_failures_same_N: 3
context_packet_token_limit: 8000

## Enforcement
- Stop an N when its cost exceeds the per-N limit.
- Stop the run when total cost exceeds the per-run limit.
- Stop after the maximum number of Ns.
- Produce a checkpoint after every configured interval.
- Stop after three consecutive failures on the same N.
- Never continue when cost information is unavailable.

If the environment cannot measure actual model cost, record cost_$: unavailable and stop before autonomous multi-N execution. Do not fabricate cost data.
