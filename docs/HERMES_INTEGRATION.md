# Registro de Integração Técnica — Hermes Agent (Master Spec M0)

## 1. Versão e Commit Oficial

* **Repositório Oficial**: `https://github.com/NousResearch/hermes-agent`
* **Commit Fixado**: `0a195aa4636494812a52ab7068a5ab822d050abf`
* **Ambiente de Runtime**: Python 3.10+ (compatível com Debian/Ubuntu e containers OCI).
* **Dependência do Modelo**: Provedor de inferência via API compatível com Function Calling (suportando modelos como Claude 3.5 Sonnet, Llama 3.3 70B, Qwen 2.5 via OpenRouter ou NVIDIA NIM API).

---

## 2. Estratégia de Integração e Fronteiras de Segurança

1. **Execução Estritamente no Servidor**:
   - O runtime Hermes opera em processo/container isolado de backend.
   - O frontend nunca estabelece conexão direta com o Hermes.
   - O runtime do Hermes NÃO possui credenciais administrativas do banco (`service_role` ou senhas de banco) nem acesso de escrita sem validação de domínio.
2. **Ferramentas Permitidas no Domínio (Domain Toolset)**:
   - `search_entities`: Consulta de candidatos a entidades.
   - `get_entity`: Recuperação de atributos canônicos e fatos comprovados.
   - `get_relationships`: Leitura de conexões documentadas existentes.
   - `get_evidence`: Recuperação do trecho literal de evidência e localizador.
   - `get_document_excerpt`: Leitura de excertos específicos de documentos indexados.
   - `get_source_status`: Inspeção do estado de coleta das fontes.
3. **Isolamento de Contexto e Memória**:
   - Cada execução de análise (`analysis_run_id`) opera com contexto efêmero e limpo.
   - Não há compartilhamento de estado gravável ou diretório SQLite/WAL entre clientes ou workspaces diferentes.
4. **Limites Rígidos e Cancelamento**:
   - Limite máximo de chamadas a ferramentas (`max_tool_calls = 10`).
   - Limite de tempo de execução (`timeout_seconds = 120`).
   - Limite de orçamento de tokens (`max_tokens = 4000`).
   - Suporte a interrupção limpa via `cancelAnalysis(runId)`.
5. **Continuidade Operacional da Plataforma**:
   - A base documental, busca, grafo e visualização de evidências operam com autonomia total.
   - Se o Hermes estiver temporariamente indisponível ou fora do ar, todas as funcionalidades centrais de pesquisa e conferência documental continuam operando normalmente.
