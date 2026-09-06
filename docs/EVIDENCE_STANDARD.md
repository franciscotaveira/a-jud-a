# Padrão de Evidência e Publicação — Master Spec MVP

## 1. As Quatro Dimensões da Evidência

1. **Natureza da Fonte**: API oficial, dataset oficial, certidão primária ou diário oficial.
2. **Método de Extração**:
   - `DETERMINISTIC_PARSER`: Parser de código testado que extrai campos estruturados.
   - `MANUAL_EXTRACTION`: Revisão e extração humana assistida.
   - `AI_EXTRACTION`: Extração por modelo de linguagem (obrigatoriamente marcada para revisão).
3. **Estado de Verificação**:
   - `PENDING_REVIEW`: Proposta de relação, não exibida no grafo verificado por padrão.
   - `VERIFIED`: Auditada e com trecho literal comprovado na fonte.
   - `CONFLICTING`: Documentos oficiais apresentam alegações contraditórias.
   - `REJECTED`: Rejeitada por inconsistência factual ou homônimo incorreto.
4. **Papéis de Evidência em Relações**:
   - `SUPPORTS`: Sustenta afirmativamente o vínculo.
   - `CONTRADICTS`: Apresenta divergência ou término não refletido.
   - `CONTEXTUALIZES`: Oferece histórico ou informação suplementar.

## 2. Regras Invioláveis de Publicação

* Nenhuma relação pode ser publicada como `VERIFIED` sem possuir pelo menos uma evidência associada com papel `SUPPORTS`.
* Coocorrência documental gera menção textual, nunca vínculo societário ou administrativo.
* Uma certidão comprova o que foi nela declarado; não comprova a veracidade material de alegações de terceiros.
