const apiOrigin = document.querySelector('meta[name="api-origin"]')?.content.trim();
const API_URL = new URL('/api/tarefas', apiOrigin || window.location.origin).toString();
const form = document.getElementById('form-tarefa');
const inputTitulo = document.getElementById('input-titulo');
const inputPrioridade = document.getElementById('input-prioridade');
const inputPrazo = document.getElementById('input-prazo');
const lista = document.getElementById('lista-tarefas');
const composer = document.getElementById('composer');
const botaoSalvar = document.getElementById('botao-salvar');
const botaoCancelar = document.getElementById('botao-cancelar');
const busca = document.getElementById('busca-tarefas');
const estadoVazio = document.getElementById('estado-vazio');
const mensagemStatus = document.getElementById('mensagem-status');

let tarefas = [];
let filtroAtual = 'todas';
let tarefaEmEdicao = null;
let temporizadorFeedback;

document.getElementById('data-hoje').textContent = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long', day: 'numeric', month: 'long'
}).format(new Date());

function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function mostrarErro(mensagem) {
  mensagemStatus.textContent = mensagem;
  mensagemStatus.classList.add('is-visible', 'is-error');
  clearTimeout(temporizadorFeedback);
}

function mostrarFeedback(mensagem) {
  mensagemStatus.textContent = mensagem;
  mensagemStatus.classList.add('is-visible');
  mensagemStatus.classList.remove('is-error');
  clearTimeout(temporizadorFeedback);
  temporizadorFeedback = setTimeout(() => {
    mensagemStatus.classList.remove('is-visible');
    mensagemStatus.textContent = '';
  }, 2600);
}

async function requisicao(url, opcoes = {}) {
  const resposta = await fetch(url, opcoes);
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.error || 'Não foi possível concluir a ação.');
  return dados;
}

async function carregarTarefas() {
  try {
    tarefas = await requisicao(API_URL);
    mensagemStatus.textContent = '';
    mensagemStatus.classList.remove('is-visible', 'is-error');
    clearTimeout(temporizadorFeedback);
    renderizarTarefas();
  } catch (erro) {
    mostrarErro('Não foi possível carregar as tarefas. Verifique se o servidor está ativo.');
  }
}

function formatarPrazo(prazo) {
  if (!prazo) return '';
  const [ano, mes, dia] = prazo.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(new Date(ano, mes - 1, dia));
}

function tarefasVisiveis() {
  const termo = busca.value.trim().toLocaleLowerCase('pt-BR');
  return tarefas
    .filter((tarefa) => {
      if (filtroAtual === 'pendentes' && tarefa.concluida) return false;
      if (filtroAtual === 'concluidas' && !tarefa.concluida) return false;
      return tarefa.titulo.toLocaleLowerCase('pt-BR').includes(termo);
    })
    .sort((a, b) => {
      if (a.concluida !== b.concluida) return Number(a.concluida) - Number(b.concluida);
      if (a.prazo && b.prazo && a.prazo !== b.prazo) return a.prazo.localeCompare(b.prazo);
      if (a.prazo && !b.prazo) return -1;
      if (!a.prazo && b.prazo) return 1;
      const ordemPrioridade = { alta: 0, media: 1, baixa: 2 };
      return ordemPrioridade[a.prioridade || 'media'] - ordemPrioridade[b.prioridade || 'media'];
    });
}

function atualizarResumo() {
  const concluidas = tarefas.filter((tarefa) => tarefa.concluida).length;
  const pendentes = tarefas.length - concluidas;
  const percentual = tarefas.length ? Math.round((concluidas / tarefas.length) * 100) : 0;
  document.getElementById('total-tarefas').textContent = tarefas.length;
  document.getElementById('tarefas-pendentes').textContent = pendentes;
  document.getElementById('progresso-fill').style.width = `${percentual}%`;
  document.getElementById('progresso-label').textContent = `${percentual}%`;
  document.querySelector('.progress-track').setAttribute('aria-valuenow', percentual);
  document.getElementById('limpar-concluidas').disabled = concluidas === 0;
  document.getElementById('contagem-todas').textContent = tarefas.length;
  document.getElementById('contagem-pendentes').textContent = pendentes;
  document.getElementById('contagem-concluidas').textContent = concluidas;
}

function renderizarTarefa(tarefa) {
  const item = criarElemento('li', `task-row${tarefa.concluida ? ' is-complete' : ''}`);
  const checkbox = criarElemento('input', 'task-check');
  checkbox.type = 'checkbox';
  checkbox.checked = Boolean(tarefa.concluida);
  checkbox.setAttribute('aria-label', `Marcar ${tarefa.titulo} como ${tarefa.concluida ? 'pendente' : 'concluída'}`);
  checkbox.addEventListener('change', () => atualizarTarefa(tarefa.id, { concluida: checkbox.checked }));

  const principal = criarElemento('div', 'task-main');
  principal.appendChild(criarElemento('span', 'task-title', tarefa.titulo));
  const metadados = criarElemento('div', 'task-meta');
  const prioridade = tarefa.prioridade || 'media';
  const nomesPrioridade = { alta: 'Prioridade alta', media: 'Prioridade média', baixa: 'Prioridade baixa' };
  metadados.appendChild(criarElemento('span', `tag priority-${prioridade}`, nomesPrioridade[prioridade]));
  if (tarefa.prazo) {
    const vencida = !tarefa.concluida && tarefa.prazo < new Date().toISOString().slice(0, 10);
    metadados.appendChild(criarElemento('span', `due-date${vencida ? ' is-overdue' : ''}`, `${vencida ? 'Atrasada · ' : 'Até '}${formatarPrazo(tarefa.prazo)}`));
  }
  principal.appendChild(metadados);

  const acoes = criarElemento('div', 'task-actions');
  const editar = criarElemento('button', 'icon-button', 'Editar');
  editar.type = 'button';
  editar.setAttribute('aria-label', `Editar ${tarefa.titulo}`);
  editar.addEventListener('click', () => iniciarEdicao(tarefa));
  const excluir = criarElemento('button', 'icon-button delete', 'Excluir');
  excluir.type = 'button';
  excluir.setAttribute('aria-label', `Excluir ${tarefa.titulo}`);
  excluir.addEventListener('click', () => excluirTarefa(tarefa.id));
  acoes.append(editar, excluir);

  item.append(checkbox, principal, acoes);
  lista.appendChild(item);
}

function renderizarTarefas() {
  lista.replaceChildren();
  atualizarResumo();
  const visiveis = tarefasVisiveis();
  visiveis.forEach(renderizarTarefa);

  const semTarefas = tarefas.length === 0;
  estadoVazio.style.display = visiveis.length ? 'none' : 'block';
  document.getElementById('vazio-titulo').textContent = semTarefas ? 'Tudo começa com uma ideia.' : 'Nenhuma tarefa por aqui.';
  document.getElementById('vazio-texto').textContent = semTarefas
    ? 'Adicione sua primeira tarefa para organizar o dia.'
    : 'Tente outro filtro ou ajuste sua busca.';
  document.getElementById('titulo-lista').textContent = filtroAtual === 'todas'
    ? 'Sua lista'
    : filtroAtual === 'pendentes' ? 'Tarefas pendentes' : 'Tarefas concluídas';
}

function iniciarEdicao(tarefa) {
  tarefaEmEdicao = tarefa.id;
  inputTitulo.value = tarefa.titulo;
  inputPrioridade.value = tarefa.prioridade || 'media';
  inputPrazo.value = tarefa.prazo || '';
  composer.classList.add('is-editing');
  botaoSalvar.innerHTML = '<span aria-hidden="true">✓</span> Salvar';
  inputTitulo.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicao() {
  tarefaEmEdicao = null;
  form.reset();
  composer.classList.remove('is-editing');
  botaoSalvar.innerHTML = '<span aria-hidden="true">+</span> Adicionar';
}

async function atualizarTarefa(id, alteracoes) {
  try {
    await requisicao(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alteracoes)
    });
    await carregarTarefas();
    if (alteracoes.concluida !== undefined) {
      mostrarFeedback(alteracoes.concluida ? 'Tarefa concluída.' : 'Tarefa reaberta.');
    } else {
      mostrarFeedback('Tarefa atualizada.');
    }
  } catch (erro) {
    await carregarTarefas();
    mostrarErro(erro.message);
  }
}

async function excluirTarefa(id) {
  try {
    await requisicao(`${API_URL}/${id}`, { method: 'DELETE' });
    await carregarTarefas();
    if (tarefaEmEdicao === id) cancelarEdicao();
    mostrarFeedback('Tarefa removida.');
  } catch (erro) {
    mostrarErro(erro.message);
  }
}

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const tarefa = {
    titulo: inputTitulo.value.trim(),
    prioridade: inputPrioridade.value,
    prazo: inputPrazo.value || null
  };
  if (!tarefa.titulo) return;

  const estavaEditando = tarefaEmEdicao !== null;
  botaoSalvar.disabled = true;
  try {
    if (estavaEditando) {
      await requisicao(`${API_URL}/${tarefaEmEdicao}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tarefa)
      });
    } else {
      await requisicao(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tarefa)
      });
    }
    cancelarEdicao();
    await carregarTarefas();
    mostrarFeedback(estavaEditando ? 'Tarefa atualizada.' : 'Tarefa adicionada.');
  } catch (erro) {
    mostrarErro(erro.message);
  } finally {
    botaoSalvar.disabled = false;
  }
});

botaoCancelar.addEventListener('click', cancelarEdicao);
busca.addEventListener('input', renderizarTarefas);
document.querySelectorAll('[data-filtro]').forEach((botao) => {
  botao.addEventListener('click', () => {
    filtroAtual = botao.dataset.filtro;
    document.querySelectorAll('[data-filtro]').forEach((item) => {
      item.setAttribute('aria-pressed', String(item === botao));
    });
    renderizarTarefas();
  });
});

document.getElementById('limpar-concluidas').addEventListener('click', async () => {
  try {
    const resultado = await requisicao(`${API_URL}/concluidas`, { method: 'DELETE' });
    await carregarTarefas();
    mostrarFeedback(`${resultado.deleted} ${resultado.deleted === 1 ? 'tarefa concluída removida.' : 'tarefas concluídas removidas.'}`);
  } catch (erro) {
    mostrarErro(erro.message);
  }
});

document.addEventListener('keydown', (evento) => {
  if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
    evento.preventDefault();
    busca.focus();
  }
  if (evento.key === 'Escape' && document.activeElement === busca && busca.value) {
    busca.value = '';
    renderizarTarefas();
  }
});

carregarTarefas();