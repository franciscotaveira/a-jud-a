# Hermes Agent Integration Specification & Viability Audit

## 1. Versão e Commit Fixado

* **Repositório Oficial**: `https://github.com/NousResearch/hermes-agent`
* **Commit Fixado**: `0a195aa4636494812a52ab7068a5ab822d050abf`
* **Ambiente de Runtime**: Python 3.10+ (compatível com o Python 3.14 do host e containers OCI baseados em Debian/Ubuntu).
* **Dependência do Modelo**: Provedor OpenRouter / OpenAI-compatible API com suporte a function calling / tool calling.

---

## 2. Capacidades Auditadas no Repositório Real

1. **Agente e Orquestração (`run_agent.py`)**:
   - Classe núcleo `AIAgent`.
   - Suporte nativo a mixins:
     - `InterruptControlMixin`: suporte a cancelamento limpo de inferência e controle de execução.
     - `IterationBudget`: controle rígido de limites de passos e chamadas de ferramentas.
     - `StreamDeliveryMixin`: streaming de deltas e eventos de execução.
     - `ActivityTrackingMixin` e `ActivityProvenance`: rastreabilidade de ações.
     - `ToolGuardrailDecision`: barreiras e validação de chamadas de ferramentas.
2. **Gateway e Sessões (`gateway/run.py`, `gateway/stream_events.py`)**:
   - Arquitetura de gateway baseada em sessão com isolamento de `session_context.py` e controle de tempo `turn_lease.py`.
   - Streaming com eventos estruturados de saída.
3. **Ferramentas (`tools/`, `mcp_serve.py`, `toolsets.py`)**:
   - Capacidade de rodar com toolsets seletivos.
   - Suporte nativo ao protocolo MCP (Model Context Protocol).

---

## 3. Limitações e Fronteiras de Segurança Obrigatórias

Para cumprir as diretrizes inegociáveis da plataforma:

1. **Zero Acesso Direto a Bancos ou Credenciais**:
   - O runtime do Hermes NÃO possui credenciais administrativas do Supabase ou PostgreSQL.
   - O runtime do Hermes NÃO possui permissão para executar shell livre (`bash`, `sh`, etc.) em produção.
2. **Isolamento de Memória**:
   - As sessões locais do Hermes são descartáveis por `analysis_run_id`.
   - Não há diretório SQLite/WAL compartilhado entre workspaces de clientes distintos.
   - Desabilitado o aprendizado autônomo não supervisionado em produção.
3. **Mediação por Adapter (`packages/hermes-adapter`)**:
   - O Adapter da Plataforma atua como intermediário exclusivo entre o `worker` da plataforma e o runtime do Hermes.
   - O runtime do Hermes consome ferramentas exclusivamente fornecidas pela API de domínio autorizada via MCP ou HTTP Bridge seguro.
4. **Contrato de Saída Estruturada**:
   - Toda resposta gerada deve aderir ao schema de análise estruturada com `summary`, `statements` (com `evidence_ids`), `limitations`, `contradictions` e `open_questions`.

---

## 4. Prova de Conceito de Execução do Runtime (M0)

O M0 providencia a interface `HermesAdapter` implementada em TypeScript com validação Zod e mock explícito de integração para testes unitários, além da especificação do serviço de container isolado para deploy na VPS MCT.
