#!/bin/bash
set -e

URLS=(
  "https://static.poder360.com.br/uploads/2026/09/pet16662_relatorio_pf_celular_vorcaro_moraes_gonet_andrei_barci.pdf"
  "https://static.poder360.com.br/uploads/2026/09/pet16662-whatsapp-vorcaro-alexandre-moraes-sigiloderrubado-1set2026.pdf"
  "https://static.poder360.com.br/uploads/2026/09/pet16662-contrato-barci-moraes-banco-master-108milhoes-sigiloderrubado-1set2026.pdf"
  "https://static.poder360.com.br/uploads/2026/09/pet16662-acordo-dacao-viking-barci-aviao-helicoptero-50milhoes-sigiloderrubado.pdf"
  "https://static.poder360.com.br/uploads/2026/09/pet16662-contrato-viking-barci-moraes-50milhoes-sigiloderrubado-1set2026.pdf"
)

DEST="data/raw_artifacts/banco_master"

for url in "${URLS[@]}"; do
  filename=$(basename "$url")
  echo "Baixando $filename..."
  curl -sSL -A "Mozilla/5.0" "$url" -o "$DEST/$filename"
  echo "Calculando SHA-256..."
  shasum -a 256 "$DEST/$filename"
done
