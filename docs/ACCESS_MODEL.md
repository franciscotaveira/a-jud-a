# Modelo de Acesso, Autenticação e Autorização

## 1. Identidade e Sessões

* **Autenticação**: Supabase Auth via tokens JWT.
* **Segurança no Cliente**: Frontend apenas porta a chave anônima pública (`anon_key`) e envia o Bearer Token do usuário autenticado.
* **Segurança no Servidor**: A API de domínio (`services/platform-api`) utiliza a `service_role_key` de forma privada para operações privilegiadas e faz a verificação estrita do usuário chamador.

## 2. Níveis de Permissão (Roles)

1. `admin`:
   - Gestão de membros do workspace.
   - Configuração de conectores de fontes públicas.
   - Auditoria completa de custos e logs imutáveis.
2. `analista`:
   - Realização de consultas a CNPJ e organizações.
   - Disparo de solicitações de análise documental ao Hermes Agent.
   - Criação e revisão de evidências.
3. `leitor`:
   - Visualização de entidades, relações, grafos e documentos já ingeridos.
   - Sem permissão para disparar jobs de ingestão ou consumir cotas de IA.
