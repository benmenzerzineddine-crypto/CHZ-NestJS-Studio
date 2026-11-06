# Step 07 — One-command Docker verification

**Goal:** after a successful generation, prove the generated stack actually
starts, migrates/seeds, serves health, accepts a login and returns seeded data
with a single command.

- **Depends on:** [`05-depth.md`](05-depth.md) (M4 accepted)
- **Plan reference:** `plan.md` §5, §9

---

## Scope

**In:** a `--docker` mode for `scripts/verify-output.mjs`, isolated compose
project names, generated compose port overrides, npm scripts and documentation.

**Out:** a studio button that runs Docker on every generation. Docker is slow and
optional; generation stays fast and the verification is explicit.

---

## Tasks

- [x] Add `--docker` and `--keep-stack` to `scripts/verify-output.mjs`:
      - write a temporary `.env` with random JWT secrets, admin credentials and
        a generated DB password;
      - set unique compose project/network/volume names;
      - run `docker compose up --build -d --wait`;
      - assert health, admin login, `/api/auth/me`, and seeded rows for `blog`;
      - dump compose logs on failure;
      - run `docker compose down -v --remove-orphans` unless `--keep-stack`.
- [x] Add `DB_HOST_PORT` to generated Postgres/MySQL compose files so verification
      does not collide with a host database on 5432/3306.
- [x] Add npm scripts:
      - `npm run verify:docker` (SQLite)
      - `npm run verify:docker:postgres`
      - `npm run verify:docker:mysql`
- [x] Document the command in `AGENTS.md` and `plan.md` §10.
- [x] Update snapshots and verify both SQLite and Postgres stacks.

---

## Definition of done

1. `npm run verify:docker` builds the generated stack, waits for health, logs in
   and confirms seeded rows, then removes the stack.
2. The same command with `--driver postgres` passes without host port conflicts.
3. `--keep-stack` leaves the stack running for debugging.
4. `npm test` and `npm run build` stay green.
5. No secrets or generated projects are written into the repository.

---

## Verification

```bash
npm run verify:docker
npm run verify:docker:postgres
npm test
npm run build
```

---

## Verification log

- 2026-11-03 — Implementation was already present from the M4-era work; this
  pass confirmed and verified it: `npm run verify:docker` (SQLite) and
  `npm run verify:docker:postgres` both built the generated stack, waited for
  health (200), logged in as the seeded admin and saw seed rows, then tore the
  stack down. `npm test` 28 files / 259 tests green. `--keep-stack` and
  `verify:docker:mysql` are implemented but mysql verification was not run
  (not part of this plan's DoD).
