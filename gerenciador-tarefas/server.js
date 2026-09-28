require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_SSL = process.env.DATABASE_SSL === 'true';
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!DATABASE_URL) {
  console.error('DATABASE_URL não definida. Configure a conexão PostgreSQL no ambiente.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_SSL ? true : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (erro) => {
  console.error('Erro inesperado no pool PostgreSQL:', erro.code || 'erro sem código');
});

// Middlewares
app.use(cors({ origin: corsOrigins.length ? corsOrigins : false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function inicializarBanco() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tarefas (
      id SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      concluida BOOLEAN NOT NULL DEFAULT FALSE,
      prioridade TEXT NOT NULL DEFAULT 'media'
        CHECK (prioridade IN ('baixa', 'media', 'alta')),
      prazo DATE
    )
  `);
}

function prazoValido(prazo) {
  if (prazo === null || prazo === '') return true;
  if (typeof prazo !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) return false;
  const data = new Date(`${prazo}T00:00:00.000Z`);
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === prazo;
}

function responderErroBanco(res, operacao, erro) {
  console.error(`Falha ao ${operacao} tarefa:`, erro.code || 'erro sem código');
  return res.status(500).json({ error: 'Não foi possível concluir a operação.' });
}

// Rotas da API (CRUD)

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (erro) {
    console.error('Health check PostgreSQL falhou:', erro.code || 'erro sem código');
    res.status(503).json({ status: 'error' });
  }
});

// 1. Listar todas as tarefas (READ)
app.get('/api/tarefas', async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT id, titulo, concluida, prioridade, TO_CHAR(prazo, 'YYYY-MM-DD') AS prazo FROM tarefas ORDER BY id DESC"
    );
    res.json(resultado.rows);
  } catch (erro) {
    responderErroBanco(res, 'listar', erro);
  }
});

// 2. Criar nova tarefa (CREATE)
app.post('/api/tarefas', async (req, res) => {
  const titulo = typeof req.body?.titulo === 'string' ? req.body.titulo.trim() : '';
  const prioridade = req.body.prioridade || 'media';
  const prazo = req.body.prazo || null;
  if (!titulo) return res.status(400).json({ error: 'Título é obrigatório' });
  if (titulo.length > 160) return res.status(400).json({ error: 'O título deve ter até 160 caracteres.' });
  if (!['baixa', 'media', 'alta'].includes(prioridade)) {
    return res.status(400).json({ error: 'Prioridade inválida' });
  }
  if (!prazoValido(prazo)) return res.status(400).json({ error: 'Prazo inválido.' });

  try {
    const resultado = await pool.query(
      "INSERT INTO tarefas (titulo, prioridade, prazo) VALUES ($1, $2, $3) RETURNING id, titulo, concluida, prioridade, TO_CHAR(prazo, 'YYYY-MM-DD') AS prazo",
      [titulo, prioridade, prazo]
    );
    res.status(201).json(resultado.rows[0]);
  } catch (erro) {
    responderErroBanco(res, 'criar', erro);
  }
});

// 3. Atualizar tarefa (UPDATE)
app.put('/api/tarefas/:id', async (req, res) => {
  const atualizacoes = [];
  const valores = [];
  const { titulo, prioridade, prazo, concluida } = req.body || {};

  if (titulo !== undefined) {
    if (typeof titulo !== 'string' || !titulo.trim()) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }
    if (titulo.trim().length > 160) {
      return res.status(400).json({ error: 'O título deve ter até 160 caracteres.' });
    }
    atualizacoes.push('titulo = ?');
    valores.push(titulo.trim());
  }
  if (prioridade !== undefined) {
    if (!['baixa', 'media', 'alta'].includes(prioridade)) {
      return res.status(400).json({ error: 'Prioridade inválida' });
    }
    atualizacoes.push('prioridade = ?');
    valores.push(prioridade);
  }
  if (prazo !== undefined) {
    if (!prazoValido(prazo)) return res.status(400).json({ error: 'Prazo inválido.' });
    atualizacoes.push('prazo = ?');
    valores.push(prazo || null);
  }
  if (concluida !== undefined) {
    if (typeof concluida !== 'boolean') {
      return res.status(400).json({ error: 'O estado de conclusão deve ser booleano.' });
    }
    atualizacoes.push('concluida = ?');
    valores.push(concluida);
  }
  if (atualizacoes.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  }

  const clausulas = atualizacoes.map((clausula, indice) =>
    clausula.replace('?', `$${indice + 1}`)
  );
  try {
    const resultado = await pool.query(
      `UPDATE tarefas SET ${clausulas.join(', ')} WHERE id = $${valores.length + 1}`,
      [...valores, req.params.id]
    );
    if (resultado.rowCount === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });
    res.json({ updated: resultado.rowCount });
  } catch (erro) {
    responderErroBanco(res, 'atualizar', erro);
  }
});

// 4. Remover tarefas concluídas
app.delete('/api/tarefas/concluidas', async (req, res) => {
  try {
    const resultado = await pool.query('DELETE FROM tarefas WHERE concluida = TRUE');
    res.json({ deleted: resultado.rowCount });
  } catch (erro) {
    responderErroBanco(res, 'remover concluídas', erro);
  }
});

// 5. Deletar tarefa (DELETE)
app.delete('/api/tarefas/:id', async (req, res) => {
  try {
    const resultado = await pool.query('DELETE FROM tarefas WHERE id = $1', [req.params.id]);
    res.json({ deleted: resultado.rowCount });
  } catch (erro) {
    responderErroBanco(res, 'remover', erro);
  }
});

inicializarBanco()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Servidor PostgreSQL rodando na porta ${server.address().port}`);
    });
  })
  .catch((erro) => {
    console.error('Falha ao inicializar PostgreSQL:', erro.code || 'verifique DATABASE_URL e a conectividade');
    pool.end().finally(() => process.exit(1));
  });