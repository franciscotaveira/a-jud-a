# Matriz de Validação e Critérios de Aceite — Master Spec M0

## 1. Classificação Obrigatória do Estado dos Recursos

| Componente / Regra | Estado | Evidência de Validação |
|---|---|---|
| **Resolução Conservadora de Identidades** | `TESTADO EM UNIDADE` | Regressão comprovada: CNPJ `00000000000000` bloqueado para `AUTO_MATCH`. Pessoas físicas nunca se fundem por nome (`tests/m0_verification.test.ts`). |
| **Contrato Mínimo do HermesAdapter** | `TESTADO EM UNIDADE` | Validação de schema estruturado, cancelamento e ciclo de vida mock (`tests/m0_verification.test.ts`). |
| **Integridade Criptográfica SHA-256 e Locators** | `TESTADO EM UNIDADE` | Hash do artefato e offset de caracteres conferidos rigorosamente (`tests/m0_verification.test.ts`). |
| **Integridade Documental: Exigência de Evidência SUPPORTS** | `TESTADO EM BANCO` | Constraint Trigger no PostgreSQL rejeitou relação `VERIFIED` sem evidência (`tests/m0_verification.test.ts`). |
| **Integridade Documental: Exclusão do Último Suporte** | `TESTADO EM BANCO` | Exclusão de evidência `SUPPORTS` foi bloqueada no PostgreSQL por trigger transacional (`tests/m0_verification.test.ts`). |
| **Integridade Documental: Alteração de Papel para CONTRADICTS** | `TESTADO EM BANCO` | Alteração de role para `CONTRADICTS` sem suporte sobressalente bloqueada no PostgreSQL (`tests/m0_verification.test.ts`). |
| **Persistência da Cadeia Sintética Completa** | `TESTADO EM BANCO` | Fonte → Artefato → Documento → Evidência → Entidades → Relação persistidos no PostgreSQL local (`tests/m0_verification.test.ts`). |
| **Políticas de Acesso (RLS)** | `TESTADO EM BANCO` | SELECT liberado publicamente; INSERT/UPDATE bloqueado no PostgreSQL para usuário anônimo sem privilégios (`tests/m0_verification.test.ts`). |
| **Isolamento de Fixture Sintética** | `TESTADO EM UNIDADE` | Fixture 100% sintética em `fixtures/demo/synthetic_fixture.json` validada contra schemas Zod. Banco Master e CNPJ real completamente desvinculados da demonstração. |
| **Interface Web Demonstrável** | `DEMONSTRADO NA INTERFACE` | Servida via Docker na porta 3000 com aviso de dados sintéticos. |
| **Integração com Hermes Real (Python/Gateway)** | `PENDENTE` | Especificada contratualmente no M0; execução real programada para o Marco M2. |
| **Conector de Fonte Primária Oficial** | `PENDENTE` | Ingestão de API governamental programada para o Marco M2. |
