---
applyTo: "{index.html,admin.html,vota.html,scripts/**/*.js,tests/**/*.js}"
description: "Stricter testing rules for frontend and JavaScript changes"
---

# Frontend/JS testing discipline

For changes touching frontend pages, `scripts/**/*.js`, or tests:

- Treat every functional behavior change as requiring test coverage in `tests/unit` and/or `tests/bdd`.
- For every new function or bug fix, add at least one dedicated automated test that fails before the fix and passes after it.
- If UI/business behavior changes intentionally, update existing tests in the same pull request.
- Before marking work complete, run at least the most relevant test file(s) for the changed logic (for example `npm test -- tests/unit/<file>.test.js` or `npm test -- tests/bdd/<file>.test.js`) and ensure they pass.
- Run the broader test suite (`npm test`) when feasible.
- Never finalize functional JS/frontend changes without passing tests relevant to the modified behavior.
