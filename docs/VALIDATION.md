# Guia de Validação e Critérios de Aceite — Master Spec MVP

## 1. Classificação Obrigatória do Estado dos Recursos

Todo componente e recurso da plataforma deve ser categorizado de forma inequívoca em um dos seguintes estados:

* `IMPLEMENTADO`: Código escrito, tipado e com build aprovado.
* `TESTADO`: Verificado por suíte de testes automatizados com assertions executadas.
* `DEMONSTRADO COM FIXTURES`: Validado de ponta a ponta na interface com dados fictícios identificados.
* `VERIFICADO COM FONTE REAL`: Ingestão executada contra fonte oficial, com artefato preservado e hash calculado.
* `PENDENTE DE DEPENDÊNCIA EXTERNA`: Requer configuração de infraestrutura, credencial ou banco remoto ainda não conectado.

## 2. Matriz de Verificação do Marco M0

| Requisito | Status | Evidência de Validação |
|---|---|---|
| Contratos Zod do Domínio | `TESTADO` | `packages/contracts/src/index.ts` compilado |
| Normalização e Validação de CNPJ | `TESTADO` | 3 testes em `tests/m0_verification.test.ts` |
| Resolução Conservadora de Identidade | `TESTADO` | 3 testes em `tests/m0_verification.test.ts` (bloqueio de fusão de pessoas) |
| Integridade Criptográfica SHA-256 e Trecho | `TESTADO` | 2 testes em `tests/m0_verification.test.ts` |
| Múltiplas Evidências com Papéis | `TESTADO` | Schema `RelationshipEvidence` com `role` testado |
| Contrato de Conector `PublicDataConnector` | `IMPLEMENTADO` | `packages/connectors/src/index.ts` compilado |
| Migration SQL Núcleo com RLS | `IMPLEMENTADO` | `supabase/migrations/00001_initial_schema.sql` criada |
| Aplicação da Migration em Banco Remoto | `PENDENTE DE DEPENDÊNCIA EXTERNA` | Requer conexão ativa com instância Supabase |
| Isolamento e Aviso Legal de Fixture | `TESTADO` | Teste de verificação de disclaimer legal na fixture |
