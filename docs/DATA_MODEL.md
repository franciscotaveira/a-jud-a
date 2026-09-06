# Modelo de Dados Canônico — Master Spec MVP

## 1. Dicionário de Tabelas do Banco de Dados

* `entities`: Entidade primária (`ORGANIZATION`, `PERSON`, `PROCESS`, `CONTRACT`, `FUND`, `AIRCRAFT`).
* `entity_identifiers`: Identificadores únicos (`CNPJ`, `CPF`, `CVM_CODE`, `BACEN_CODE`, `PROCESS_CNJ`).
* `entity_aliases`: Nomes alternativos ou denominações anteriores com vínculo opcional de evidência.
* `entity_facts`: Atributos factuais exibidos (`field_name`, `value`, `evidence_id`, `valid_from`, `valid_until`).
* `sources`: Fontes primárias oficiais cadastradas e seus métodos de acesso.
* `source_artifacts`: Artefatos brutos originais coletados, com SHA-256 e metadata da requisição.
* `documents`: Documentos lógicos contidos nos artefatos (`title`, `document_type`, `date_precision`, `extracted_text`).
* `evidence`: Trechos literais citáveis (`excerpt`, `locator` JSON, `extraction_method`, `review_status`).
* `relationships`: Arestas direcionadas do grafo (`subject_entity_id`, `predicate`, `object_entity_id`, `verification_status`).
* `relationship_evidence`: Associação N:N entre relações e evidências com papéis (`SUPPORTS`, `CONTRADICTS`, `CONTEXTUALIZES`).
* `events`: Eventos cronológicos documentados.
* `event_entities` & `event_evidence`: Vínculos de entidades e evidências a eventos.
* `connector_runs`: Execuções de ingestão, status e diagnósticos higienizados.
* `review_queue`: Fila de revisão para conciliação ou extrações incertas.
