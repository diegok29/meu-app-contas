# Meu planner Diário

Aplicação de tarefas com interface web, API Express e PostgreSQL.

## Executar localmente

1. Copie `.env.example` para `.env`.
2. Preencha `DATABASE_URL` com a URL do banco PostgreSQL.
3. Para uma URL externa do Render, use `DATABASE_SSL=true`. No Render, prefira a URL interna e `DATABASE_SSL=false`.
4. Execute:

```sh
npm ci
npm start
```

Acesse `http://localhost:3000`. O servidor cria a tabela `tarefas` ao iniciar. Para validar a sintaxe, execute `npm run check`.

## Publicar no Render

Crie um Web Service para este projeto e configure:

- Build Command: `npm ci`
- Start Command: `npm start`
- `DATABASE_URL`: Internal Database URL do PostgreSQL no painel Render. O Web Service e o banco precisam estar na mesma região; não inclua a URL no repositório.
- `DATABASE_SSL`: `false` para a URL interna na rede privada do Render. Para conexão externa, use `true`.
- `CORS_ORIGIN`: deixe vazio se a interface e a API estiverem no mesmo domínio. Se forem separadas, informe a origem exata do frontend.

O Render fornece `PORT` automaticamente. O endpoint `/api/health` verifica a conexão com o banco.

Este projeto contém um servidor Express e não pode ser hospedado apenas no GitHub Pages. Tarefas existentes no banco SQLite local não são copiadas automaticamente para o PostgreSQL.

## Segurança

A API ainda não tem autenticação. Qualquer pessoa que alcance o serviço pode consultar, criar, alterar ou excluir tarefas. Não armazene dados privados até adicionar login e autorização. Se uma URL de conexão foi compartilhada fora do painel de segredos, redefina a senha do banco.