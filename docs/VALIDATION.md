# Matriz de Validação e Critérios de Aceite — Marco M1 (Docker Live)

Data da Validação: 06/09/2026

## 1. Classificação Obrigatória do Estado dos Recursos

| Componente / Regra | Estado | Evidência de Validação |
|---|---|---|
| **Resolução Conservadora de Identidades** | `TESTADO EM UNIDADE` | Regressão comprovada: CNPJ `00000000000000` bloqueado para `AUTO_MATCH`. Pessoas físicas nunca se fundem por homonímia (`tests/m0_verification.test.ts`). |
| **Contrato Mínimo do HermesAdapter** | `TESTADO EM UNIDADE` | Validação de schema estruturado, cancelamento e ciclo de vida mock (`tests/m0_verification.test.ts`). Preservado para o Marco M2. |
| **Integridade Criptográfica SHA-256 e Locators** | `TESTADO EM UNIDADE` | Hashes SHA-256 dos 5 PDFs conferidos, trechos literais extraídos com sucesso (`tests/m0_verification.test.ts`). |
| **Integridade Documental: Exigência de Evidência SUPPORTS** | `TESTADO EM BANCO` | Constraint Trigger no PostgreSQL rejeitou relação `VERIFIED` sem evidência (`tests/m0_verification.test.ts`). |
| **Integridade Documental: Exclusão do Último Suporte** | `TESTADO EM BANCO` | Exclusão de evidência `SUPPORTS` foi bloqueada no PostgreSQL por trigger transacional (`tests/m0_verification.test.ts`). |
| **Integridade Documental: Alteração de Papel para CONTRADICTS** | `TESTADO EM BANCO` | Alteração de role para `CONTRADICTS` sem suporte sobressalente bloqueada no PostgreSQL (`tests/m0_verification.test.ts`). |
| **Integridade Concorrente: Lock FOR NO KEY UPDATE** | `TESTADO EM BANCO` | Teste com duas conexões simultâneas tentando remover suportes distintos serializado; T2 aborta com violação de integridade (`tests/concurrency_integrity.test.ts`). |
| **Transferência de Suporte (UPDATE)** | `TESTADO EM BANCO` | Trigger valida tanto `OLD.relationship_id` quanto `NEW.relationship_id`. Rejeita se a relação de origem perder o último suporte (`tests/concurrency_integrity.test.ts`). |
| **Separação de Banco de Dados** | `TESTADO EM BANCO` | Banco de testes `pig_br_test` 100% separado do banco de produção/demonstração `pig_br`. Zero fixtures sintéticas no acervo exibido. |
| **Papel Restrito da Aplicação e RLS** | `TESTADO EM BANCO` | Papel `pig_br_api_user` com `NOSUPERUSER` e `NOBYPASSRLS`. `POST /api/entities` bloqueado com `HTTP 403 Forbidden` (`code: 42501`). |
| **Fila de Revisão Protegida** | `TESTADO EM BANCO` | `GET /api/admin/review-queue` bloqueado com `HTTP 401 Unauthorized` sem token; autorizado com `HTTP 200 OK` via papel `pig_br_analyst`. |
| **Extração Documental e OCR (Pet 16.662)** | `TESTADO EM BANCO` | 5 documentos originais baixados, textos extraídos via parser nativo e Tesseract OCR. Hashes conferidos. |
| **Ingestão Auditável com Status PENDING_REVIEW** | `TESTADO EM BANCO` | Relações inseridas em `PENDING_REVIEW` na `review_queue`. Nenhuma promoção automática sem conferência humana. |
| **Interface Web e Fluxo E2E no Navegador** | `DEMONSTRADO NA INTERFACE` | Executado no Google Chrome real (porta 3000): Busca → Entidade → Grafo → Relação (PENDING_REVIEW) → Painel de Evidências (Trecho Literal + SHA-256) → Abertura de PDF. |
| **Integração Real com Motor Hermes (M2)** | `HOMOLOGADO NO RUNTIME E INTERFACE` | Runtime `services/hermes-runtime` integrado ao backend Docker com API `/api/analysis/runs`. Painel de análise no frontend com segregação estrita (`DOCUMENTED_RECORD`, `INTERPRETATION`, `LIMITATION`), citações auditadas de evidências e ressalvas legais. Validado em testes (`tests/hermes_adapter.test.ts`) e no navegador via Chrome (`/tmp/browser_m2_hermes_scrolled.png`). |


---

## 2. Instruções de Execução da Suíte Completa

```bash
# Executar todos os testes automatizados (unidade + concorrência + integridade transacional + RLS)
npm test

# Build do frontend e backend
npm run build

# Subir todos os serviços em Docker
docker compose up -d --build
```
