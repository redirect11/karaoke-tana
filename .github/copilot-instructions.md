# Repository instructions for Copilot and coding agents

## Mandatory testing policy for functional changes

- Any functional logic change **must** include automated tests (new tests or updates to existing tests).
- Any new function, bug fix, or business logic change **must** have at least one dedicated automated test.
- If expected behavior changes, update the related existing tests in the same change.
- Before considering a task complete, run at least the tests most relevant to the changed logic and verify they pass.
- When a broader suite exists, run it when feasible before finalizing the work.
- If no relevant test exists for the changed behavior, add one.
- Do not propose or finalize functional code changes that are not verified by relevant passing tests.
