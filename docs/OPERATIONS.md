# Operações, Fila Assíncrona e Monitoramento

## 1. Fila de Jobs Transacional no PostgreSQL

Para evitar overhead desnecessário com Redis/Kafka na fundação M0/M1, os jobs de ingestão e análise de IA operam através da tabela `connector_runs` e `analysis_runs` no próprio PostgreSQL:

* **Claim Atômico**: Uso da cláusula `FOR UPDATE SKIP LOCKED`.
* **Lease e Heartbeat**: Workers renovam periodicamente o timestamp de lease. Se um worker cair em falha não tratada, o job é recuperado por outro worker após timeout configurado.
* **Idempotência**: Jobs de ingestão calculam hash dos parâmetros de busca para não reenfileirar consultas idênticas em janela de tempo recente.

## 2. Orçamento e Limites de Análise

Cada execução de análise pelo Hermes Agent impõe:
* Limite de tempo estrito (Timeout padrão: 120s).
* Limite máximo de chamadas a ferramentas autorizadas (Max tool calls: 10).
* Limite máximo de tokens de contexto e geração.
* Registro de telemetria e auditoria de cada passo executado.
