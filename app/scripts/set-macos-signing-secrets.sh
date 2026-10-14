#!/usr/bin/env bash
# Upload a Developer ID .p12 to the GitHub secrets the macOS build reads.
# Checks the file first: right certificate type, private key present, password
# correct. Sets MACOS_CERTIFICATE_P12_BASE64, MACOS_CERTIFICATE_PASSWORD and
# APPLE_TEAM_ID (taken from the certificate). The password is read hidden and
# passed only through stdin and the environment, never as an argument.
#
# Usage: app/scripts/set-macos-signing-secrets.sh [path/to/cert.p12] [--dry-run]
# Default path: Certificates.p12 in the folder above the repository.
set -euo pipefail

repo_root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
p12="$(dirname "$repo_root")/Certificates.p12"
dry_run=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=true ;;
    *) p12=$arg ;;
  esac
done

fail() { echo "Error: $1" >&2; exit 1; }

[ -s "$p12" ] || fail "$p12 is missing or empty. Export it from Keychain Access (login, My Certificates) as .p12."
command -v openssl >/dev/null || fail "openssl not found. Install it with: brew install openssl"
command -v gh >/dev/null || fail "gh not found. Install it with: brew install gh"
repo=$(cd "$repo_root" && gh repo view --json nameWithOwner --jq .nameWithOwner) || fail "gh cannot see the repository. Run: gh auth login"

read -r -s -p "Password for $(basename "$p12"): " P12_PASSWORD
echo
export P12_PASSWORD

# Keychain Access may export with legacy ciphers that OpenSSL 3 reads only with -legacy.
pkcs12() { openssl pkcs12 -in "$p12" -passin env:P12_PASSWORD "$@" 2>/dev/null || openssl pkcs12 -legacy -in "$p12" -passin env:P12_PASSWORD "$@" 2>/dev/null; }

pkcs12 -noout || fail "cannot open $p12. Wrong password, or not a .p12 file."
# grep -c reads to the end; grep -q would exit early and trip pipefail.
[ "$(pkcs12 -nocerts -nodes | grep -c 'PRIVATE KEY')" -gt 0 ] \
  || fail "$p12 has no private key. Export the certificate from the My Certificates tab, where it shows a key under it."
subject=$(pkcs12 -nokeys -clcerts | openssl x509 -noout -subject -nameopt multiline 2>/dev/null) \
  || fail "$p12 has no certificate matching its private key."

name=$(sed -n 's/^ *commonName *= *//p' <<<"$subject")
team=$(sed -n 's/^ *organizationalUnitName *= *//p' <<<"$subject")
[[ $name == "Developer ID Application:"* ]] \
  || fail "certificate is \"$name\", not a Developer ID Application certificate. Apple Development certificates cannot sign apps for other Macs."
[[ $team =~ ^[A-Z0-9]{10}$ ]] || fail "cannot read a team ID from the certificate (found \"$team\")."

echo "Certificate: $name"
echo "Team ID:     $team"
echo "Repository:  $repo"

if $dry_run; then
  echo "Dry run: checks passed, no secrets set."
  exit 0
fi

base64 -i "$p12" | gh secret set MACOS_CERTIFICATE_P12_BASE64 -R "$repo"
printf '%s' "$P12_PASSWORD" | gh secret set MACOS_CERTIFICATE_PASSWORD -R "$repo"
gh secret set APPLE_TEAM_ID -R "$repo" --body "$team"
echo "Secrets set. APPLE_ID and APPLE_APP_SPECIFIC_PASSWORD are unchanged."

read -r -p "Delete $p12 now? It holds your private key. [Y/n] " answer
if [[ ! $answer =~ ^[Nn] ]]; then
  rm "$p12"
  echo "Deleted. The certificate stays in your keychain."
else
  echo "Kept. Store it somewhere safe, outside any git repository."
fi
