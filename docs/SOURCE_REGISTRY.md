# Registro de Fontes Públicas Oficiais — Master Spec MVP

## 1. Critérios de Homologação de Fontes

Antes de plugar qualquer conector, a fonte deve possuir:
- Documentação técnica e endpoint oficial verificados.
- Especificação exata dos identificadores aceitos (CNPJ, Razão Social, CNJ).
- Política de rate limit, paginação e termos de redistribuição.
- Capacidade comprovada de sustentar ao menos uma relação documental verificada.

## 2. Catálogo de Fontes Candidatas para o M2

1. **Receita Federal do Brasil (Dados Abertos CNPJ)**:
   - Identificadores: CNPJ de 14 dígitos.
   - Fornece: Cadastro de estabelecimentos e QSA (Quadro de Sócios e Administradores).
   - Relações sustentadas: `SHAREHOLDER_OF`, `ADMINISTRATOR_OF`, `DIRECTOR_OF`.
2. **Banco Central do Brasil (BACEN)**:
   - Identificadores: CNPJ / Código IF.
   - Fornece: Autorização de funcionamento de instituições financeiras.
3. **CVM (Comissão de Valores Mobiliários)**:
   - Identificadores: CNPJ / Código CVM.
   - Fornece: Administradores e companhias abertas reguladas.
4. **Fixture de Demonstração (`DEMO_FIXTURE`)**:
   - Dados sintéticos isolados para testes automatizados e demonstração do M1, com indicação visual permanente.
