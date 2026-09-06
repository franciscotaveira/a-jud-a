# Public Intelligence Graph Brasil — Master Specification

## 1. Princípios de Engenharia e Missão

O **Public Intelligence Graph Brasil** é uma infraestrutura de inteligência documental sobre dados públicos abertos e governamentais do Brasil.
A plataforma obedece aos preceitos da soberania de dados, integridade metodológica e auditabilidade total.

* **Unidade Fundamental**: `ENTIDADE` → `RELAÇÃO` → `EVIDÊNCIA` → `FONTE`.
* **Fluxo de Valor**: Pesquisar → Compreender → Conferir → Organizar → Acompanhar.
* **Filosofia de Dados**: *Truth in Data* — Toda relação afirmada no sistema exige uma evidência documental rastreável com localizador exato e hash criptográfico SHA-256. Proibido o uso de dados mock, pontuações de suspeita ou deduções especulativas.

---

## 2. Escopo do Produto

### 2.1. Funcionalidades Ativas (Marco M0/M1)
1. **Exploração**: Busca rigorosa por CNPJ normalizado e razão social/nome fantasia. Tratamento de homônimos sem fusão automática.
2. **Entidade**: Perfil factual canônico com atributos documentados, fontes primárias consultadas, limitações de cobertura e data de extração.
3. **Grafo de Relações**: Representação orientada a fatos. Cada aresta conecta entidades com direção semântica, período temporal conhecido, estado de verificação (`PENDING_REVIEW`, `VERIFIED`, `CONFLICTING`, `REJECTED`) e evidências atreladas.
4. **Biblioteca Documental**: Armazenamento de artefatos originais e seus trechos citados com preservação de hash SHA-256.
5. **Inteligência Contextual**: Operação interna do Hermes Agent para sumarização e explicação de relações exclusivamente através de citações documentais.

### 2.2. Expansão Futura (M2+)
* Investigações privadas por workspace.
* Monitoramento de reconsultas agendadas.
* Conectores para Diários Oficiais, CVM, BACEN, Comprasnet e Tribunais.
