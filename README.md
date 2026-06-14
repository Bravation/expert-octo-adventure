# Welcome to your Lovable project

[![Currency Tests](https://github.com/OWNER/REPO/actions/workflows/currency-tests.yml/badge.svg?branch=main)](https://github.com/OWNER/REPO/actions/workflows/currency-tests.yml)

The badge above reflects the latest status of the `Currency Tests` workflow
(`.github/workflows/currency-tests.yml`) on `main`, which enforces the
currency helpers coverage threshold (currently **80%** for statements,
branches, functions, and lines on changed `src/lib/*.ts` files). A green
badge means the most recent run passed both the unit/fuzz tests and the
coverage gate; a red badge means coverage dropped below the threshold or
a test failed — see the workflow run and the PR coverage summary comment
for details. Replace `OWNER/REPO` with your GitHub `owner/repository`
slug after pushing this repo to GitHub.

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Slack test workflow: `slack-test-summary.json`

The `Slack notification test` workflow (`.github/workflows/slack-test.yml`)
uploads a machine-readable summary artifact named `slack-test-summary.json`
after every run. Consumers (dashboards, follow-up jobs, humans triaging a
failure) rely on its shape, so it carries an explicit `schema_version`
field to keep changes backward compatible.

### Schema version contract

- `schema_version` is an **integer** at the top level of the JSON object.
- **Current version: `1`.**
- **Reference example:**
  [`.github/workflows/examples/slack-test-summary.example.json`](.github/workflows/examples/slack-test-summary.example.json).
  Consumers can copy this file as the canonical shape for `schema_version: 1`.
  It is also uploaded by every workflow run as the
  `slack-test-summary-example` artifact.
- **Formal JSON Schema:**
  [`.github/workflows/examples/slack-test-summary.schema.json`](.github/workflows/examples/slack-test-summary.schema.json)
  (Draft 2020-12). Both the reference example and the freshly-produced
  summary are validated against it on every workflow run via
  [`ajv-cli`](https://www.npmjs.com/package/ajv-cli) in the
  `Validate against JSON Schema (ajv)` step.
  The schema is also uploaded by every run as the
  `slack-test-summary-schema-v<N>` artifact (where `<N>` is the value of
  `schema_version`) so consumers can pin the exact schema version used to
  validate that run. The summary itself is uploaded as
  `slack-test-summary-v<N>` and the reference example as
  `slack-test-summary-example-v<N>` using the same suffix.
- Producer: the `post-sample` step sets `SUMMARY_SCHEMA_VERSION` and writes
  it into the JSON via `jq`.
- Validator: the `Validate Slack test summary JSON` step checks the file
  against `EXPECTED_SCHEMA_VERSION` and fails the run on mismatch.
- **Bump `schema_version` only for backward-incompatible changes** —
  removing or renaming a field, changing a field's type, or changing the
  meaning of an existing value. Additive changes (new optional fields)
  do **not** require a bump.

When you bump the version:

1. Update `SUMMARY_SCHEMA_VERSION` in the `Post sample Slack message` step.
2. Update `EXPECTED_SCHEMA_VERSION` in the `Validate Slack test summary JSON`
   step to match.
3. Update the "Current version" line above.
4. Note the breaking change for downstream consumers.

### Updating the `REQUIRED` field list

The validator checks every field listed in the `REQUIRED` heredoc inside
the `Validate Slack test summary JSON` step. Each line is `<jq path><TAB><type>`,
where `<type>` is one of `string`, `number`, `boolean`, `array`, `object`,
or `null` (the values returned by `jq`'s `type` builtin).

To add or change a required field:

1. Add or update the field in the `jq -n '{ ... }'` object inside
   `emit_summary` in the post step.
2. Add a matching `<jq path><TAB><type>` line to the `REQUIRED` heredoc in
   the validator step. Use a real tab character, not spaces.
3. If the change is backward-incompatible (removed/renamed/retyped field),
   also bump `schema_version` per the contract above.
4. Run the workflow via `workflow_dispatch` and confirm the validator step
   passes and the uploaded artifact contains the new field.

### Downloading and pinning the versioned schema artifact

Every workflow run uploads the JSON Schema as a versioned artifact named
`slack-test-summary-schema-v<N>` (e.g. `slack-test-summary-schema-v1`).
Consumers should download and **pin** this artifact in their tooling so
validation stays stable even if the producer later bumps `schema_version`.

#### 1. Download via the GitHub UI

1. Open the relevant `Slack notification test` run in the **Actions** tab.
2. Scroll to the **Artifacts** section at the bottom of the run summary.
3. Click `slack-test-summary-schema-v<N>` (where `<N>` is the version you
   want to pin against, e.g. `slack-test-summary-schema-v1`).
4. Unzip the download to obtain `slack-test-summary.schema.json`.

#### 2. Download via the GitHub CLI

```sh
# Pin to schema version 1, from a specific run id
gh run download <run-id> \
  --repo <owner>/<repo> \
  --name slack-test-summary-schema-v1 \
  --dir ./vendor/slack-test-summary
```

You can also resolve the latest successful run programmatically:

```sh
RUN_ID=$(gh run list \
  --repo <owner>/<repo> \
  --workflow slack-test.yml \
  --status success \
  --limit 1 \
  --json databaseId --jq '.[0].databaseId')

gh run download "${RUN_ID}" \
  --repo <owner>/<repo> \
  --name slack-test-summary-schema-v1 \
  --dir ./vendor/slack-test-summary
```

#### 3. Download via the REST API

```sh
curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  "https://api.github.com/repos/<owner>/<repo>/actions/artifacts" \
  | jq -r '.artifacts[] | select(.name=="slack-test-summary-schema-v1") | .archive_download_url' \
  | head -n1 \
  | xargs -I{} curl -L -H "Authorization: Bearer ${GITHUB_TOKEN}" -o schema.zip "{}"

unzip schema.zip -d ./vendor/slack-test-summary
```

#### 4. Pin it in your tooling

- **Commit the downloaded file** (e.g. to
  `vendor/slack-test-summary/slack-test-summary.schema.json`) so your
  validator uses the exact bytes you reviewed — do **not** fetch the schema
  at validation time from a moving target like `main`.
- **Always pin by version suffix** (`-v1`, `-v2`, …), never by an
  unversioned name. The version suffix is the contract: a new major version
  means breaking changes and you must explicitly opt in by downloading the
  new `-v<N+1>` artifact and updating your code.
- **Validate with `ajv-cli`** (the same validator the workflow uses) to
  guarantee identical semantics:

  ```sh
  npx --yes ajv-cli@5 validate \
    -s ./vendor/slack-test-summary/slack-test-summary.schema.json \
    -d ./path/to/your/slack-test-summary.json \
    --spec=draft2020 \
    -c ajv-formats
  ```

- **Refresh deliberately.** When you want to adopt a new schema version,
  re-run the download step against `slack-test-summary-schema-v<N+1>`,
  review the diff, update any consuming code, and commit the new file in
  the same change.

> Artifacts are retained for **14 days** (`retention-days: 14` on the
> upload step). For long-term pinning, always commit the downloaded schema
> into your own repository rather than relying on the artifact still being
> available later.

#### 5. One-command vendor script

For convenience, this repo ships
[`scripts/vendor-slack-test-summary-schema.sh`](scripts/vendor-slack-test-summary-schema.sh),
which resolves the latest successful run, downloads the
`slack-test-summary-schema-v<N>` artifact, writes it (plus a `PROVENANCE`
file recording the source repo, run id, and timestamp) into a vendor
folder, and commits the result.

```sh
# Pin schema version 1 from the producer repo into vendor/slack-test-summary
scripts/vendor-slack-test-summary-schema.sh \
  --repo <owner>/<repo>

# Pin a different version, custom vendor folder, and skip the commit
scripts/vendor-slack-test-summary-schema.sh \
  --repo <owner>/<repo> \
  --version 2 \
  --vendor-dir third_party/slack-test-summary \
  --no-commit

# Pin from a specific run id (e.g. to reproduce an older validation)
scripts/vendor-slack-test-summary-schema.sh \
  --repo <owner>/<repo> \
  --run-id 1234567890
```

Requirements: `gh` (authenticated), `git`, `sha256sum` (or `shasum -a 256`),
and a working tree of this repo.

##### SHA-256 verification

The script computes a SHA-256 for **every file** in the downloaded artifact
(the schema, any example payloads, metadata, and any future additions) and
refuses to vendor or commit if any pinned file's digest doesn't match. The
full set of digests is written to `<vendor-dir>/SHA256SUMS` (a standard
`sha256sum`-format manifest). A legacy single-file sidecar
`slack-test-summary.schema.json.sha256` is also kept for backwards
compatibility.

Expected values are resolved in priority order:

1. **Explicit flag** — pass the digest you trust for the schema file:
   ```sh
   scripts/vendor-slack-test-summary-schema.sh \
     --repo <owner>/<repo> \
     --expected-sha256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
   ```
   Or pass a `sha256sum`-style manifest covering as many files as you want
   to pin (each line: `<sha>  <relative/path>`):
   ```sh
   scripts/vendor-slack-test-summary-schema.sh \
     --repo <owner>/<repo> \
     --expected-sha256-file ./trusted/SHA256SUMS
   ```
   Every file listed in the manifest MUST be present in the download and
   MUST match. On any mismatch (or missing pinned file) the script exits
   with code **4** without writing or committing anything. A single 64-char
   hex digest in the file is still accepted (legacy: applies to the schema).

2. **Previously pinned manifest** — if
   `vendor/slack-test-summary/SHA256SUMS` already exists from a prior run,
   every file it lists is verified against the new download. This gives
   you trust-on-first-use (TOFU) pinning across the whole artifact: once
   vendored, future runs cannot silently replace any pinned file with
   different content. New files not in the prior manifest are reported and
   appended for future verification.

3. **First-time pin** — if neither of the above is available, the script
   records every downloaded file's digest into `SHA256SUMS` so all future
   runs are verified against it.

Pass `--strict-manifest` to refuse vendoring when the downloaded artifact
contains any file that isn't already listed in the pinned `SHA256SUMS`
manifest (or the manifest passed via `--expected-sha256-file`). This turns
TOFU into strict allow-listing: new files cause the script to exit with
code **5** without writing or committing anything, so adopting a new file
becomes an explicit, reviewed step.

```sh
scripts/vendor-slack-test-summary-schema.sh \
  --repo <owner>/<repo> \
  --strict-manifest
```

To allow specific new files through `--strict-manifest`, pass one or more
`--allow-new <glob>` flags. Matching files are accepted, appended to the
manifest, and committed; any other unexpected file still fails with exit
code **5**. Globs use bash pattern matching against the artifact-relative
path (e.g. `examples/*.json`, `*.md`, `metadata.json`).

```sh
scripts/vendor-slack-test-summary-schema.sh \
  --repo <owner>/<repo> \
  --strict-manifest \
  --allow-new 'examples/*.json' \
  --allow-new 'CHANGELOG.md'
```

To always reject specific new files (even when an `--allow-new` pattern
would otherwise permit them), pass one or more `--deny-new <glob>` flags.
`--deny-new` takes precedence over `--allow-new` and applies whether or
not `--strict-manifest` is set, so it works as a hard block-list. Any
match still fails the run with exit code **5**.

```sh
scripts/vendor-slack-test-summary-schema.sh \
  --repo <owner>/<repo> \
  --strict-manifest \
  --allow-new 'examples/*.json' \
  --deny-new 'examples/*.secret.json' \
  --deny-new '*.exe'
```

All per-file digests are also written into the `PROVENANCE` file, and the
schema digest (first 12 chars) plus the file count are embedded in the
auto-generated commit message.

## Running service-role security tests

A subset of Vitest tests (e.g. `src/test/profilesEmailServiceRole.test.ts`)
verify that the Supabase **service role** can read sensitive columns
(like provider emails) while authenticated non-owners cannot. These
assertions are gated behind the `SUPABASE_SERVICE_ROLE_KEY` environment
variable and are skipped when it is not set.

### Local development

1. Open the Lovable Cloud backend for this project and copy the
   **service role key** (a server-only secret — never commit it or
   expose it to the browser).
2. Run Vitest with the key injected as an environment variable:

   ```sh
   SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>" npm test
   ```

   Without the variable, the service-role assertions are skipped and the
   rest of the suite still runs.

### CI (GitHub Actions)

The `.github/workflows/vitest.yml` workflow **requires**
`SUPABASE_SERVICE_ROLE_KEY` and fails fast with a clear error message
when it is missing. To configure it:

1. In GitHub, go to **Settings → Secrets and variables → Actions →
   New repository secret**.
2. Create a secret named exactly `SUPABASE_SERVICE_ROLE_KEY` and paste
   the service role key as its value.
3. Re-run the workflow. The guard step will pass and Vitest will run
   the full suite, including service-role tests.

> Security note: the service role key bypasses Row-Level Security. Only
> store it as a GitHub **secret** (never as a plain variable), never log
> it, and never reference it from any `VITE_*` variable or other
> client-side code.
