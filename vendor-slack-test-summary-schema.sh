#!/usr/bin/env bash
# vendor-slack-test-summary-schema.sh
#
# One-command helper that downloads the versioned `slack-test-summary-schema-v<N>`
# artifact from the most recent successful run of the `Slack notification test`
# workflow and commits it into a vendor folder in this repo so downstream
# tooling can validate against a pinned schema.
#
# Usage:
#   scripts/vendor-slack-test-summary-schema.sh \
#     --repo <owner>/<repo> \
#     [--version 1] \
#     [--workflow slack-test.yml] \
#     [--vendor-dir vendor/slack-test-summary] \
#     [--run-id <id>] \
#     [--expected-sha256 <hex> | --expected-sha256-file <path>] \
#     [--strict-manifest] [--allow-new <glob> ...] [--deny-new <glob> ...] \
#     [--no-commit]
#
# Requirements:
#   - GitHub CLI (`gh`) authenticated with access to the producer repo.
#   - `git` available; run from inside the consumer repo's working tree.
#   - `unzip` available (used by `gh run download` transparently).
#   - `sha256sum` or `shasum -a 256` available for checksum verification.
#
# Checksum behavior:
#   - SHA-256 is computed for EVERY file inside the downloaded artifact
#     (the schema, any example payloads, metadata files, etc.) — not just
#     `slack-test-summary.schema.json`.
#   - If --expected-sha256 (single hex digest) is provided, it is treated
#     as the expected digest for `slack-test-summary.schema.json` and that
#     file MUST match. All other files fall back to manifest/TOFU below.
#   - If --expected-sha256-file is provided, it may be either:
#       a) a single 64-char hex digest (legacy: applies to the schema), or
#       b) a `sha256sum`-style manifest with `<sha>  <filename>` lines, in
#          which case every file listed MUST match exactly.
#   - If neither flag is provided AND a previously vendored manifest exists
#     at `<vendor-dir>/SHA256SUMS`, every downloaded file listed there MUST
#     match (TOFU pinning across the whole artifact). New files not in the
#     prior manifest are appended to it.
#   - If no expected values exist at all, the script records a fresh
#     `<vendor-dir>/SHA256SUMS` covering every downloaded file so subsequent
#     runs are verified against it.
#   - The legacy single-file sidecar
#     `<vendor-dir>/slack-test-summary.schema.json.sha256` is still written
#     for backwards compatibility.
#
# Exit codes:
#   0  success
#   1  bad usage / missing dependency
#   2  no successful run found
#   3  download or commit failure
#   4  checksum mismatch (any file)
#   5  unexpected new file(s) under --strict-manifest

set -euo pipefail

REPO=""
VERSION="1"
WORKFLOW="slack-test.yml"
VENDOR_DIR="vendor/slack-test-summary"
RUN_ID=""
DO_COMMIT=1
EXPECTED_SHA256=""
EXPECTED_SHA256_FILE=""
STRICT_MANIFEST=0
ALLOW_NEW_GLOBS=()
DENY_NEW_GLOBS=()

usage() {
  sed -n '2,45p' "$0"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)        REPO="$2";        shift 2 ;;
    --version)     VERSION="$2";     shift 2 ;;
    --workflow)    WORKFLOW="$2";    shift 2 ;;
    --vendor-dir)  VENDOR_DIR="$2";  shift 2 ;;
    --run-id)      RUN_ID="$2";      shift 2 ;;
    --expected-sha256)      EXPECTED_SHA256="$2";      shift 2 ;;
    --expected-sha256-file) EXPECTED_SHA256_FILE="$2"; shift 2 ;;
    --strict-manifest) STRICT_MANIFEST=1; shift ;;
    --allow-new) ALLOW_NEW_GLOBS+=("$2"); shift 2 ;;
    --deny-new) DENY_NEW_GLOBS+=("$2"); shift 2 ;;
    --no-commit)   DO_COMMIT=0;      shift ;;
    -h|--help)     usage ;;
    *) echo "Unknown argument: $1" >&2; usage ;;
  esac
done

if [[ -z "${REPO}" ]]; then
  echo "error: --repo <owner>/<repo> is required" >&2
  usage
fi

for cmd in gh git; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "error: required command not found: ${cmd}" >&2
    exit 1
  fi
done

# Pick a SHA-256 implementation.
sha256_of() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${file}" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${file}" | awk '{print $1}'
  else
    echo "error: neither sha256sum nor shasum is available for checksum verification" >&2
    exit 1
  fi
}

# Normalize an expected hex digest: lowercase, strip whitespace, allow
# `<sha>  filename` style lines from sha256sum output.
normalize_sha256() {
  awk '{print tolower($1)}' <<<"$1" | tr -d '[:space:]'
}

ARTIFACT_NAME="slack-test-summary-schema-v${VERSION}"

if [[ -z "${RUN_ID}" ]]; then
  echo "==> Resolving latest successful run of ${WORKFLOW} in ${REPO}..."
  RUN_ID="$(gh run list \
    --repo "${REPO}" \
    --workflow "${WORKFLOW}" \
    --status success \
    --limit 1 \
    --json databaseId --jq '.[0].databaseId' || true)"
  if [[ -z "${RUN_ID}" || "${RUN_ID}" == "null" ]]; then
    echo "error: no successful run found for workflow ${WORKFLOW} in ${REPO}" >&2
    exit 2
  fi
fi
echo "==> Using run id: ${RUN_ID}"
echo "==> Artifact:     ${ARTIFACT_NAME}"
echo "==> Vendor dir:   ${VENDOR_DIR}"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${REPO_ROOT}" ]]; then
  echo "error: must be run inside a git working tree" >&2
  exit 1
fi

TARGET_DIR="${REPO_ROOT}/${VENDOR_DIR}"
mkdir -p "${TARGET_DIR}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

echo "==> Downloading artifact..."
if ! gh run download "${RUN_ID}" \
      --repo "${REPO}" \
      --name "${ARTIFACT_NAME}" \
      --dir "${TMP_DIR}"; then
  echo "error: failed to download artifact ${ARTIFACT_NAME} from run ${RUN_ID}" >&2
  echo "       (artifacts expire after retention-days; pick a more recent run)" >&2
  exit 3
fi

SRC_FILE="${TMP_DIR}/slack-test-summary.schema.json"
if [[ ! -f "${SRC_FILE}" ]]; then
  # Fall back to whatever .json file came down, in case naming changes.
  SRC_FILE="$(find "${TMP_DIR}" -maxdepth 2 -name '*.schema.json' | head -n1)"
fi
if [[ -z "${SRC_FILE}" || ! -f "${SRC_FILE}" ]]; then
  echo "error: downloaded artifact did not contain a *.schema.json file" >&2
  exit 3
fi

# ---- Multi-file checksum verification -------------------------------------
DEST_FILE="${TARGET_DIR}/slack-test-summary.schema.json"
CHECKSUM_FILE="${DEST_FILE}.sha256"
MANIFEST_FILE="${TARGET_DIR}/SHA256SUMS"

# Enumerate every file in the downloaded artifact (relative paths, sorted).
mapfile -t DOWNLOADED_FILES < <(cd "${TMP_DIR}" && find . -type f -printf '%P\n' | sort)
if [[ "${#DOWNLOADED_FILES[@]}" -eq 0 ]]; then
  echo "error: downloaded artifact is empty" >&2
  exit 3
fi

# Compute SHA-256 for every downloaded file.
declare -A ACTUAL_HASHES=()
echo "==> Hashing ${#DOWNLOADED_FILES[@]} downloaded file(s):"
for rel in "${DOWNLOADED_FILES[@]}"; do
  h="$(sha256_of "${TMP_DIR}/${rel}")"
  ACTUAL_HASHES["${rel}"]="${h}"
  echo "    ${h}  ${rel}"
done

SCHEMA_REL="$(basename "${SRC_FILE}")"
ACTUAL_SHA256="${ACTUAL_HASHES[${SCHEMA_REL}]}"

# Build the expected-hash map from flags / manifest / TOFU.
declare -A EXPECTED_HASHES=()
EXPECTED_SOURCE=""

load_manifest_into_expected() {
  local path="$1"
  local source_label="$2"
  local line sha file
  while IFS= read -r line || [[ -n "${line}" ]]; do
    # Skip blank lines and comments.
    [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
    sha="$(awk '{print tolower($1)}' <<<"${line}" | tr -d '[:space:]')"
    file="$(awk '{ $1=""; sub(/^[[:space:]]+/,""); sub(/^\*/, ""); print }' <<<"${line}")"
    if [[ -z "${file}" ]]; then
      # Single-digest file (legacy): applies to the schema.
      file="${SCHEMA_REL}"
    fi
    if [[ ! "${sha}" =~ ^[0-9a-f]{64}$ ]]; then
      echo "error: invalid sha256 line in ${source_label}: '${line}'" >&2
      exit 1
    fi
    EXPECTED_HASHES["${file}"]="${sha}"
  done < "${path}"
}

if [[ -n "${EXPECTED_SHA256}" ]]; then
  norm="$(normalize_sha256 "${EXPECTED_SHA256}")"
  if [[ ! "${norm}" =~ ^[0-9a-f]{64}$ ]]; then
    echo "error: --expected-sha256 is not a 64-char hex digest: '${norm}'" >&2
    exit 1
  fi
  EXPECTED_HASHES["${SCHEMA_REL}"]="${norm}"
  EXPECTED_SOURCE="--expected-sha256 (schema only)"
elif [[ -n "${EXPECTED_SHA256_FILE}" ]]; then
  if [[ ! -f "${EXPECTED_SHA256_FILE}" ]]; then
    echo "error: --expected-sha256-file not found: ${EXPECTED_SHA256_FILE}" >&2
    exit 1
  fi
  load_manifest_into_expected "${EXPECTED_SHA256_FILE}" "${EXPECTED_SHA256_FILE}"
  EXPECTED_SOURCE="${EXPECTED_SHA256_FILE}"
elif [[ -f "${MANIFEST_FILE}" ]]; then
  load_manifest_into_expected "${MANIFEST_FILE}" "${MANIFEST_FILE} (previously pinned)"
  EXPECTED_SOURCE="${MANIFEST_FILE} (previously pinned)"
elif [[ -f "${CHECKSUM_FILE}" ]]; then
  # Legacy single-file sidecar: only pins the schema.
  load_manifest_into_expected "${CHECKSUM_FILE}" "${CHECKSUM_FILE} (legacy pin)"
  EXPECTED_SOURCE="${CHECKSUM_FILE} (legacy pin, schema only)"
fi

# Always check --deny-new against ALL downloaded files first — denial is a
# hard block-list that applies regardless of pinning state.
denied_new=0
for f in "${!ACTUAL_HASHES[@]}"; do
  for g in "${DENY_NEW_GLOBS[@]:-}"; do
    [[ -z "${g}" ]] && continue
    # Only treat as "new" if not already pinned via flags/manifest.
    if [[ -z "${EXPECTED_HASHES[${f}]:-}" ]]; then
      # shellcheck disable=SC2053
      if [[ "${f}" == ${g} ]]; then
        echo "error: new file '${f}' rejected by --deny-new '${g}'" >&2
        denied_new=$((denied_new+1))
        break
      fi
    fi
  done
done
if (( denied_new > 0 )); then
  echo "error: refusing to vendor — ${denied_new} file(s) blocked by --deny-new (overrides --allow-new)." >&2
  exit 5
fi

# Verify every expected entry against actual downloads.
if [[ "${#EXPECTED_HASHES[@]}" -gt 0 ]]; then
  mismatches=0
  missing=0
  for f in "${!EXPECTED_HASHES[@]}"; do
    exp="${EXPECTED_HASHES[${f}]}"
    act="${ACTUAL_HASHES[${f}]:-}"
    if [[ -z "${act}" ]]; then
      echo "error: pinned file '${f}' is missing from the downloaded artifact" >&2
      missing=$((missing+1))
      continue
    fi
    if [[ "${exp}" != "${act}" ]]; then
      echo "error: SHA-256 mismatch for '${f}'" >&2
      echo "       expected: ${exp}  (from ${EXPECTED_SOURCE})" >&2
      echo "       actual:   ${act}" >&2
      mismatches=$((mismatches+1))
    fi
  done
  if (( mismatches > 0 || missing > 0 )); then
    echo "error: refusing to vendor — ${mismatches} mismatch(es), ${missing} missing." >&2
    echo "       artifact: ${ARTIFACT_NAME} from ${REPO}@${RUN_ID}" >&2
    exit 4
  fi
  # Warn (don't fail) about new files not previously pinned — they will be
  # appended to the manifest below for future TOFU verification.
  new_files=0
  allowed_new=0
  for f in "${!ACTUAL_HASHES[@]}"; do
    if [[ -z "${EXPECTED_HASHES[${f}]:-}" ]]; then
      matched_glob=""
      for g in "${ALLOW_NEW_GLOBS[@]:-}"; do
        [[ -z "${g}" ]] && continue
        # shellcheck disable=SC2053
        if [[ "${f}" == ${g} ]]; then
          matched_glob="${g}"
          break
        fi
      done
      if (( STRICT_MANIFEST )) && [[ -z "${matched_glob}" ]]; then
        echo "error: unexpected new file '${f}' not present in pinned manifest (${EXPECTED_SOURCE})" >&2
        new_files=$((new_files+1))
      elif [[ -n "${matched_glob}" ]]; then
        echo "==> note: new file '${f}' allowed by --allow-new '${matched_glob}'; will be added to manifest."
        allowed_new=$((allowed_new+1))
      else
        echo "==> note: new file '${f}' not in prior pins; will be added to manifest."
      fi
    fi
  done
  if (( new_files > 0 )); then
    echo "error: refusing to vendor — ${new_files} unexpected new file(s) under --strict-manifest (use --allow-new to permit)." >&2
    exit 5
  fi
  echo "==> Checksums OK for ${#EXPECTED_HASHES[@]} pinned file(s) (source: ${EXPECTED_SOURCE})."
else
  if (( STRICT_MANIFEST )); then
    echo "error: --strict-manifest requires an existing manifest or --expected-sha256-file; none found." >&2
    exit 5
  fi
  echo "==> No expected checksums available; recording fresh manifest (TOFU)."
fi
# ---------------------------------------------------------------------------

# Copy every downloaded file into the vendor dir, preserving relative paths.
for rel in "${DOWNLOADED_FILES[@]}"; do
  dest="${TARGET_DIR}/${rel}"
  mkdir -p "$(dirname "${dest}")"
  cp "${TMP_DIR}/${rel}" "${dest}"
  echo "==> Wrote ${dest}"
done

# (Re)write the full SHA256SUMS manifest covering every vendored file.
{
  for rel in "${DOWNLOADED_FILES[@]}"; do
    echo "${ACTUAL_HASHES[${rel}]}  ${rel}"
  done
} > "${MANIFEST_FILE}"
echo "==> Wrote ${MANIFEST_FILE} (${#DOWNLOADED_FILES[@]} entries)"

# Keep the legacy schema-only sidecar in sync for backwards compatibility.
echo "${ACTUAL_SHA256}  slack-test-summary.schema.json" > "${CHECKSUM_FILE}"
echo "==> Wrote ${CHECKSUM_FILE}"

# Record provenance so future readers know exactly what was pinned.
PROVENANCE_FILE="${TARGET_DIR}/PROVENANCE"
{
  echo "source_repo:   ${REPO}"
  echo "workflow:      ${WORKFLOW}"
  echo "run_id:        ${RUN_ID}"
  echo "artifact:      ${ARTIFACT_NAME}"
  echo "schema_version: ${VERSION}"
  echo "schema_sha256: ${ACTUAL_SHA256}"
  echo "files:"
  for rel in "${DOWNLOADED_FILES[@]}"; do
    echo "  - ${ACTUAL_HASHES[${rel}]}  ${rel}"
  done
  echo "downloaded_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "${PROVENANCE_FILE}"
echo "==> Wrote ${PROVENANCE_FILE}"

if [[ "${DO_COMMIT}" -eq 1 ]]; then
  cd "${REPO_ROOT}"
  git add "${VENDOR_DIR}"
  if git diff --cached --quiet; then
    echo "==> No changes to commit (vendored schema already up to date)."
  else
    git commit -m "chore(vendor): pin ${ARTIFACT_NAME} from ${REPO}@${RUN_ID} (${#DOWNLOADED_FILES[@]} files, schema sha256:${ACTUAL_SHA256:0:12}…)"
    echo "==> Committed pinned schema."
  fi
else
  echo "==> Skipping commit (--no-commit). Files staged on disk only."
fi

echo "Done."