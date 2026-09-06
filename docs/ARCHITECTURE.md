# Arquitetura do Sistema — Master Spec MVP

## 1. Visão Sistêmica e Fluxo de Dados

O **Public Intelligence Graph Brasil** opera sobre a unidade fundamental inegociável:
`ENTIDADE → RELAÇÃO → EVIDÊNCIA → FONTE ORIGINAL`.

```
[ FONTE PRIMÁRIA OFICIAL ]
            │
            ▼
[ CONECTOR (packages/connectors) ]
            │  (Coleta e Preservação de Bytes com SHA-256)
            ▼
[ ARTEFATO BRUTO (source_artifacts) ]
            │
            ▼
[ NORMALIZAÇÃO & RESOLUÇÃO CONSERVADORA (packages/domain) ]
            │  (CNPJ validado, nomes normalizados, homônimos isolados)
            ▼
[ CANDIDATOS A RELAÇÕES & EVENTOS ]
            │
            ▼
[ VALIDAÇÃO DE EVIDÊNCIA (packages/evidence) ]
            │  (Trecho literal verificado no corpo do documento)
            ▼
[ PERSISTÊNCIA NO POSTGRESQL / SUPABASE ]
            │
            ▼
[ BUSCA / GRAFO CYTOSCAPE.JS / PAINEL DE EVIDÊNCIAS / CRONOLOGIA ]
```

## 2. Padrões de Isolamento e Segurança

1. **Catálogo Público Compartilhado**:
   - Dados coletados de fontes oficiais são idempotentes e universais.
   - Uma organização não é duplicada por aparecer em consultas diferentes.
2. **Políticas de Acesso (RLS)**:
   - Leitura pública (`SELECT`) permitida para consulta do catálogo de registros e relações.
   - Escrita (`INSERT`, `UPDATE`, `DELETE`) estritamente bloqueada no banco para clientes anônimos, sendo restrita ao processo de servidor/worker autenticado (`service_role`).
   - Zero exposição de credenciais privadas ou service role no frontend.
