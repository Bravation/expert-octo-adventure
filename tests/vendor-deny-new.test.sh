#!/usr/bin/env bash
# Tests for vendor-slack-test-summary-schema.sh:
#   - --deny-new overrides --allow-new
#   - matching denied new files always fail with exit code 5
#   - allow-new without a denying glob still works
#   - exact behavior holds with and without --strict-manifest
#
# The vendor script shells out to `gh run download`. We stub `gh` with a
# fake on PATH that drops a fixed set of files into the requested --dir,
# so the test is hermetic and needs no network or GitHub auth.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENDOR_SCRIPT="${SCRIPT_DIR}/../vendor-slack-test-summary-schema.sh"

if [[ ! -x "${VENDOR_SCRIPT}" ]]; then
  chmod +x "${VENDOR_SCRIPT}" 2>/dev/null || true
fi

TESTS_RUN=0
TESTS_FAILED=0

pass() { echo "  ok  - $1"; }
fail() { echo "  not ok - $1" >&2; TESTS_FAILED=$((TESTS_FAILED+1)); }

# Build a hermetic workspace per test case.
make_workspace() {
  local ws
  ws="$(mktemp -d)"
  # Fake `gh` that ignores everything and just populates --dir.
  mkdir -p "${ws}/bin"
  cat > "${ws}/bin/gh" <<'GH'
#!/usr/bin/env bash
# Minimal fake supporting:
#   gh run list ... --json databaseId --jq '.[0].databaseId'
#   gh run download <id> --repo X --name Y --dir <path>
set -euo pipefail
cmd="${1:-}"; sub="${2:-}"
if [[ "${cmd}" == "run" && "${sub}" == "list" ]]; then
  echo "999"
  exit 0
fi
if [[ "${cmd}" == "run" && "${sub}" == "download" ]]; then
  dir=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dir) dir="$2"; shift 2 ;;
      *) shift ;;
    esac
  done
  : "${dir:?fake gh: --dir required}"
  mkdir -p "${dir}/examples"
  printf '{"schema_version":1}\n' > "${dir}/slack-test-summary.schema.json"
  printf '{"hello":"world"}\n'    > "${dir}/examples/sample.json"
  printf 'secret\n'               > "${dir}/examples/leaked.secret.json"
  exit 0
fi
echo "fake gh: unsupported invocation: $*" >&2
exit 1
GH
  chmod +x "${ws}/bin/gh"
  # Fresh git repo to act as REPO_ROOT (no commit needed; the script only
  # uses `git rev-parse --show-toplevel` and we always pass --no-commit).
  ( cd "${ws}" && git init -q )
  echo "${ws}"
}

# Run the vendor script in a workspace, return its exit code (no set -e abort).
run_vendor() {
  local ws="$1"; shift
  (
    cd "${ws}"
    PATH="${ws}/bin:${PATH}" \
      "${VENDOR_SCRIPT}" \
        --repo fake/repo \
        --no-commit \
        "$@" \
        > "${ws}/out.log" 2>&1
  )
}

expect_exit() {
  local label="$1" expected="$2" actual="$3" ws="$4"
  TESTS_RUN=$((TESTS_RUN+1))
  if [[ "${actual}" == "${expected}" ]]; then
    pass "${label} (exit ${actual})"
  else
    fail "${label}: expected exit ${expected}, got ${actual}"
    echo "----- output -----" >&2
    sed 's/^/    /' "${ws}/out.log" >&2 || true
    echo "------------------" >&2
  fi
}

expect_grep() {
  local label="$1" pattern="$2" ws="$3"
  TESTS_RUN=$((TESTS_RUN+1))
  if grep -qE "${pattern}" "${ws}/out.log"; then
    pass "${label}"
  else
    fail "${label}: missing /${pattern}/ in output"
    sed 's/^/    /' "${ws}/out.log" >&2 || true
  fi
}

echo "# vendor-deny-new tests"

# Case 1: --deny-new alone (no strict) → still rejects matching new file.
ws="$(make_workspace)"
set +e
run_vendor "${ws}" --deny-new 'examples/*.secret.json'
rc=$?
set -e
expect_exit "deny-new alone fails on match" 5 "${rc}" "${ws}"
expect_grep "deny-new emits rejection message" "rejected by --deny-new" "${ws}"

# Case 2: --allow-new alone permits the same file (baseline).
ws="$(make_workspace)"
set +e
run_vendor "${ws}" \
  --allow-new 'examples/*.json' \
  --allow-new 'examples/*.secret.json'
rc=$?
set -e
expect_exit "allow-new alone succeeds" 0 "${rc}" "${ws}"

# Case 3: --deny-new overrides --allow-new with --strict-manifest.
ws="$(make_workspace)"
set +e
run_vendor "${ws}" \
  --strict-manifest \
  --allow-new 'examples/*.json' \
  --allow-new 'examples/*.secret.json' \
  --deny-new 'examples/*.secret.json'
rc=$?
set -e
expect_exit "deny-new overrides allow-new under --strict-manifest" 5 "${rc}" "${ws}"
expect_grep "override message names denied glob" "examples/\*\.secret\.json" "${ws}"

# Case 4: --deny-new overrides --allow-new without --strict-manifest too.
ws="$(make_workspace)"
# Pre-pin the non-secret files so only the secret is "new" from TOFU's view.
mkdir -p "${ws}/vendor/slack-test-summary"
# Compute hashes the same way the script does.
sha() { sha256sum "$1" 2>/dev/null | awk '{print $1}' \
        || shasum -a 256 "$1" | awk '{print $1}'; }
# Run once to populate the manifest, allowing everything.
set +e
run_vendor "${ws}" \
  --allow-new 'examples/*.json' \
  --allow-new 'examples/*.secret.json'
rc=$?
set -e
expect_exit "seed run succeeds" 0 "${rc}" "${ws}"
# Now wipe just the secret from the manifest so it becomes "new" again,
# and re-run with deny-new + allow-new (no strict).
grep -v 'examples/leaked.secret.json' \
  "${ws}/vendor/slack-test-summary/SHA256SUMS" \
  > "${ws}/vendor/slack-test-summary/SHA256SUMS.tmp"
mv "${ws}/vendor/slack-test-summary/SHA256SUMS.tmp" \
   "${ws}/vendor/slack-test-summary/SHA256SUMS"
set +e
run_vendor "${ws}" \
  --allow-new 'examples/*.secret.json' \
  --deny-new  'examples/*.secret.json'
rc=$?
set -e
expect_exit "deny-new overrides allow-new without --strict-manifest" 5 "${rc}" "${ws}"

echo
echo "# ${TESTS_RUN} tests, ${TESTS_FAILED} failed"
if (( TESTS_FAILED > 0 )); then
  exit 1
fi
exit 0