# Registro de Ingestão Documental — Acervo Petição 16.662 / STF (Operação Compliance Zero)

## 1. Origem e Proveniência dos Artefatos

* **Origem da Coleta**: Documentos públicos com sigilo levantado pelo Min. André Mendonça (STF) na Petição 16.662, disponibilizados e arquivados pelo portal Poder360 em setembro/2026.
* **Momento da Coleta**: 06/09/2026 às 07:50 BRT.
* **Diretório Canônico**: `data/raw_artifacts/banco_master/`
* **Diretório de Textos Extraídos**: `data/extracted_texts/banco_master/`

---

## 2. Artefatos Coletados e Hashes Criptográficos SHA-256

| Nome do Arquivo | Tamanho | SHA-256 | Descrição Documental |
|---|---|---|---|
| `pet16662_relatorio_pf_celular_vorcaro_moraes_gonet_andrei_barci.pdf` | 5.3 MB | `30e24f6d8abd6c033c50594ff2658a4ad72b2ac818f312ea3fe54e80a5d052d7` | Informação de Polícia Judiciária de Análise nº 3298613/2026 (PF/DICOR) - Aparelho celular apreendido na Operação Compliance Zero. |
| `pet16662-contrato-barci-moraes-banco-master-108milhoes-sigiloderrubado-1set2026.pdf` | 11.0 MB | `a8ad2a2a45900da587a7b79f6afac020bb837caa284c592515aada58b0c518c8` | Contrato de prestação de serviços e honorários entre Banco Master S.A. e Barci de Moraes Sociedade de Advogados. |
| `pet16662-contrato-viking-barci-moraes-50milhoes-sigiloderrubado-1set2026.pdf` | 188 KB | `6ab6936b0316d3ab075dc115156e0c7f2ca656377650d9df3b87e246e732d58c` | Contrato de prestação de serviços entre Viking Participações Ltda. e Barci de Moraes Sociedade de Advogados. |
| `pet16662-acordo-dacao-viking-barci-aviao-helicoptero-50milhoes-sigiloderrubado.pdf` | 7.7 MB | `ea78d5008a53f59f2f606a4c509094a992fab5662a7b52f9905f4816accc63fd` | Termo de Acordo e Dação em Pagamento (ações de Fraction 024 - aeronave PR-NLR e Fraction 053 - helicóptero EC 155 B1). |
| `pet16662-whatsapp-vorcaro-alexandre-moraes-sigiloderrubado-1set2026.pdf` | 1.2 MB | `309704af37d7aa28926c3c3e5acf4d1e7d5f4f0fa2f273bc2554b99273ca8a1d` | Registro de mensagens anexadas aos autos. |

---

## 3. Entidades e Relações Documentadas Identificadas nos Artefatos

### 3.1. Entidades Principais
1. **BANCO MASTER S.A.** (`ORGANIZATION`)
   - Identificador primário: CNPJ `33.923.798/0001-00`.
   - Papel: Contratante de serviços jurídicos e de compliance.
2. **VIKING PARTICIPAÇÕES LTDA.** (`ORGANIZATION`)
   - Papel: Sociedade controlada/representada por Daniel Vorcaro, interveniente e contratante.
3. **BARCI DE MORAES SOCIEDADE DE ADVOGADOS** (`ORGANIZATION`)
   - Papel: Contratada para prestação de serviços jurídicos e de compliance.
4. **DANIEL BUENO VORCARO** (`PERSON`)
   - Papel: Representante da Viking Participações e acionista/proprietário do Banco Master.
5. **GUILHERME DE TOLEDO BENAZZI** (`PERSON`)
   - Papel: Administrador/representante da Barci de Moraes Sociedade de Advogados.
6. **FRACTION 024 ADMINISTRAÇÃO DE BEM PRÓPRIO S.A.** (`ORGANIZATION`)
   - Papel: Possuidora de aeronave executiva (matrícula PR-NLR citada em dação em pagamento).
7. **FRACTION 053 ADMINISTRAÇÃO DE BEM PRÓPRIO S.A.** (`ORGANIZATION`)
   - Papel: Titular de direitos para aquisição de helicóptero modelo Airbus EC 155 B1.

### 3.2. Relações Documentais Suportadas
* `BANCO MASTER S.A.` ──[ `CONTRACTED_WITH` ]──> `BARCI DE MORAES SOCIEDADE DE ADVOGADOS`
  - **Evidência**: `pet16662-contrato-barci-moraes-banco-master-108milhoes-sigiloderrubado-1set2026.pdf` (Página 1 e 5).
  - **Papel da Evidência**: `SUPPORTS`.
* `VIKING PARTICIPAÇÕES LTDA.` ──[ `CONTRACTED_WITH` ]──> `BARCI DE MORAES SOCIEDADE DE ADVOGADOS`
  - **Evidência**: `pet16662-contrato-viking-barci-moraes-50milhoes-sigiloderrubado-1set2026.pdf` (Página 1).
  - **Papel da Evidência**: `SUPPORTS`.
* `DANIEL BUENO VORCARO` ──[ `REPRESENTS` ]──> `VIKING PARTICIPAÇÕES LTDA.`
  - **Evidência**: Termo de qualificação de partes no contrato Viking (Página 1).
  - **Papel da Evidência**: `SUPPORTS`.
* `GUILHERME DE TOLEDO BENAZZI` ──[ `ADMINISTRATOR_OF` ]──> `BARCI DE MORAES SOCIEDADE DE ADVOGADOS`
  - **Evidência**: Cláusula de qualificação em ambos os contratos (Página 1).
  - **Papel da Evidência**: `SUPPORTS`.
* `VIKING PARTICIPAÇÕES LTDA.` ──[ `SHAREHOLDER_OF` ]──> `FRACTION 024 ADMINISTRAÇÃO DE BEM PRÓPRIO S.A.`
  - **Evidência**: Termo de Acordo e Dação em Pagamento (Página 1).
  - **Papel da Evidência**: `SUPPORTS`.

---

## 4. Conformidade com o Master Spec

1. **Separação Factual Rigorosa**: O fato documentado é a celebração do contrato de prestação de serviços e o termo de dação em pagamento. O inquérito policial e os relatórios de análise constatam a existência das minutas e materiais apreendidos, sem que isso represente juízo de culpa final da plataforma.
2. **Proveniência e Imutabilidade**: Todos os 5 PDFs encontram-se preservados integralmente com seus respectivos hashes SHA-256 catalogados para fins de auditoria.
