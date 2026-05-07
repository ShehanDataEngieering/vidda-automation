#!/usr/bin/env bash
# Downloads official EUR-Lex regulation PDFs into backend/src/db/pdfs/
# Run once before npm run seed
set -euo pipefail

DEST="$(dirname "$0")/../src/db/pdfs"
mkdir -p "$DEST"

echo "Downloading compliance regulation PDFs to $DEST..."

download() {
  local name="$1"
  local url="$2"
  local out="$DEST/$name"
  if [ -f "$out" ]; then
    echo "  [skip] $name already exists"
  else
    echo "  [download] $name"
    curl -L --retry 3 --progress-bar -o "$out" "$url" || {
      echo "  [warn] Failed to download $name — skipping"
      rm -f "$out"
    }
  fi
}

# GDPR — Regulation (EU) 2016/679
download "gdpr.pdf" \
  "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32016R0679"

# AMLD6 — Directive (EU) 2018/1673 (AML)
download "amld6.pdf" \
  "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32018L1673"

# DORA — Regulation (EU) 2022/2554
download "dora.pdf" \
  "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32022R2554"

# MiFID II — Directive 2014/65/EU
download "mifid2.pdf" \
  "https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX:32014L0065"

echo ""
echo "Done. Files in $DEST:"
ls -lh "$DEST"/*.pdf 2>/dev/null || echo "  (no PDFs downloaded)"
echo ""
echo "Now run: npm run seed"
