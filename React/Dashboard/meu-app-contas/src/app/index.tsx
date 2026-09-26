import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Keyboard,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type Conta = {
  id: string;
  descricao: string;
  valor: number;
  categoria: string;
  data: string;
};

type Provento = {
  id: string;
  descricao: string;
  valor: number;
  data: string;
};

declare global {
  interface Window {
    desktopFiles?: {
      salvarBackup(conteudo: string): Promise<boolean>;
      abrirBackup(): Promise<string | null>;
    };
  }
}

const STORAGE_KEY = '@meu_app_contas';
const STORAGE_PROVENTOS_KEY = '@meu_app_proventos';
const STORAGE_TITULO_KEY = '@meu_app_titulo_relatorio';
const armazenamento = createAsyncStorage('meu-app-contas');

const isListaContasValida = (valor: unknown): valor is Conta[] => {
  return Array.isArray(valor) && valor.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const conta = item as Partial<Conta>;
    return (
      typeof conta.id === 'string' &&
      typeof conta.descricao === 'string' &&
      typeof conta.valor === 'number' &&
      typeof conta.categoria === 'string' &&
      typeof conta.data === 'string'
    );
  });
};

const isListaProventosValida = (valor: unknown): valor is Provento[] => {
  return Array.isArray(valor) && valor.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const provento = item as Partial<Provento>;
    return (
      typeof provento.id === 'string' &&
      typeof provento.descricao === 'string' &&
      typeof provento.valor === 'number' &&
      typeof provento.data === 'string'
    );
  });
};

const categoriasFiltro = [
  'Todas',
  'Moradia',
  'Alimentação',
  'Transporte',
  'Combustível',
  'Cartão de Crédito',
  'Contas Fixas',
  'Financiamentos',
  'Saúde',
  'Entretenimento',
  'Geral',
];
const categoriasCadastro = [
  'Moradia',
  'Alimentação',
  'Transporte',
  'Combustível',
  'Cartão de Crédito',
  'Contas Fixas',
  'Financiamentos',
  'Saúde',
  'Entretenimento',
  'Geral',
];

const contasIniciais: Conta[] = [
  { id: '1', descricao: 'Aluguel', valor: 1200, categoria: 'Moradia', data: '02/09' },
  { id: '2', descricao: 'Supermercado', valor: 600, categoria: 'Alimentação', data: '05/09' },
  { id: '3', descricao: 'Internet', valor: 100, categoria: 'Moradia', data: '07/09' },
  { id: '4', descricao: 'Combustível', valor: 180, categoria: 'Transporte', data: '10/09' },
];

const formatCurrency = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

const escapeHtml = (valor: string) => valor
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const criarIdLancamento = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function App() {
  const [contas, setContas] = useState<Conta[]>(contasIniciais);
  const [descricao, setDescricao] = useState('');
  const [descricaoProvento, setDescricaoProvento] = useState('');
  const [valor, setValor] = useState('');
  const [provento, setProvento] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('Geral');
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todas');
  const [categoriaCadastroAberta, setCategoriaCadastroAberta] = useState(false);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [proventos, setProventos] = useState<Provento[]>([]);
  const [tituloRelatorio, setTituloRelatorio] = useState('Minhas contas');
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [buscaLancamentos, setBuscaLancamentos] = useState('');
  const mensagemTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrarMensagem = (texto: string) => {
    if (mensagemTimeout.current) {
      clearTimeout(mensagemTimeout.current);
    }

    setMensagem(texto);
    mensagemTimeout.current = setTimeout(() => {
      setMensagem('');
      mensagemTimeout.current = null;
    }, 2200);
  };

  useEffect(() => {
    return () => {
      if (mensagemTimeout.current) {
        clearTimeout(mensagemTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const dadosSalvos = await armazenamento.getMany([
          STORAGE_KEY,
          STORAGE_PROVENTOS_KEY,
          STORAGE_TITULO_KEY,
        ]);

        const dados = dadosSalvos[STORAGE_KEY];
        const proventos = dadosSalvos[STORAGE_PROVENTOS_KEY];
        const titulo = dadosSalvos[STORAGE_TITULO_KEY];

        if (titulo?.trim()) {
          setTituloRelatorio(titulo);
        }

        if (dados) {
          try {
            const lista = JSON.parse(dados) as unknown;
            if (isListaContasValida(lista)) {
              setContas(lista);
            }
          } catch {
            console.warn('Dados de contas inválidos no AsyncStorage. Ignorando...');
          }
        }

        if (proventos) {
          try {
            const lista = JSON.parse(proventos) as unknown;
            if (isListaProventosValida(lista)) {
              setProventos(lista);
            } else {
              const valorLegado = Number(proventos);
              if (!Number.isNaN(valorLegado) && valorLegado > 0) {
                setProventos([{
                  id: `${Date.now()}-legado`,
                  descricao: 'Provento importado',
                  valor: valorLegado,
                  data: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                }]);
              }
            }
          } catch {
            const valorLegado = Number(proventos);
            if (!Number.isNaN(valorLegado) && valorLegado > 0) {
              setProventos([{
                id: `${Date.now()}-legado`,
                descricao: 'Provento importado',
                valor: valorLegado,
                data: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
              }]);
            }
          }
        }
      } catch (error) {
        console.warn('Erro ao carregar dados salvos:', error);
      } finally {
        setDadosCarregados(true);
      }
    };

    carregarDados();
  }, []);

  useEffect(() => {
    if (!dadosCarregados || !isListaContasValida(contas) || !isListaProventosValida(proventos)) return;

    const salvarDados = async () => {
      try {
        const contasSerializadas = JSON.stringify(contas);
        const proventosSerializados = JSON.stringify(proventos);
        const tituloSerializado = String(tituloRelatorio);

        await armazenamento.setItem(STORAGE_KEY, contasSerializadas);
        await armazenamento.setItem(STORAGE_PROVENTOS_KEY, proventosSerializados);
        await armazenamento.setItem(STORAGE_TITULO_KEY, tituloSerializado);
      } catch (error) {
        console.warn('Erro ao salvar dados no AsyncStorage:', error instanceof Error ? error.message : error);
      }
    };

    salvarDados();
  }, [contas, proventos, tituloRelatorio, dadosCarregados]);

  const contasFiltradas = useMemo(() => {
    if (categoriaFiltro === 'Todas') return contas;
    return contas.filter((conta) => conta.categoria === categoriaFiltro);
  }, [contas, categoriaFiltro]);

  const total = useMemo(
    () => contasFiltradas.reduce((acumulador, contaAtual) => acumulador + contaAtual.valor, 0),
    [contasFiltradas]
  );

  const totalProventos = useMemo(
    () => proventos.reduce((acumulador, item) => acumulador + item.valor, 0),
    [proventos]
  );

  const saldoRestante = useMemo(() => {
    return totalProventos - total;
  }, [totalProventos, total]);

  const resumoPorCategoria = useMemo(() => {
    const agrupado = contas.reduce<Record<string, number>>((acc, conta) => {
      acc[conta.categoria] = (acc[conta.categoria] ?? 0) + conta.valor;
      return acc;
    }, {});

    const entradas = Object.entries(agrupado)
      .map(([categoria, valor]) => ({ categoria, valor }))
      .sort((a, b) => b.valor - a.valor);

    const valorMaximo = entradas.length ? Math.max(...entradas.map((item) => item.valor)) : 1;

    return entradas.map((item) => ({
      ...item,
      percentual: Math.max((item.valor / valorMaximo) * 100, 12),
    }));
  }, [contas]);

  const contagemPorCategoria = useMemo(() => {
    return contas.reduce<Record<string, number>>((acc, conta) => {
      acc[conta.categoria] = (acc[conta.categoria] ?? 0) + 1;
      return acc;
    }, {});
  }, [contas]);

  const lancamentosFiltrados = useMemo(() => {
    const consulta = buscaLancamentos.trim().toLocaleLowerCase('pt-BR');
    return [
      ...contas.map((conta) => ({ ...conta, tipo: 'Gasto' })),
      ...proventos.map((item) => ({ ...item, categoria: 'Provento', tipo: 'Provento' })),
    ]
      .filter((item) => !consulta || `${item.descricao} ${item.categoria} ${item.data}`.toLocaleLowerCase('pt-BR').includes(consulta))
      .sort((a, b) => (Number(b.id.split('-')[0]) || 0) - (Number(a.id.split('-')[0]) || 0));
  }, [buscaLancamentos, contas, proventos]);

  const removerLancamento = (tipo: 'Gasto' | 'Provento', id: string) => {
    const confirmar = () => {
      if (tipo === 'Gasto') {
        setContas((atuais) => atuais.filter((item) => item.id !== id));
      } else {
        setProventos((atuais) => atuais.filter((item) => item.id !== id));
      }
      mostrarMensagem(`${tipo} removido`);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Remover este ${tipo.toLocaleLowerCase('pt-BR')}?`)) confirmar();
      return;
    }

    Alert.alert('Remover lançamento', `Deseja remover este ${tipo.toLocaleLowerCase('pt-BR')}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: confirmar },
    ]);
  };

  const adicionarConta = () => {
    if (!descricao.trim() || !valor.trim()) return;

    const valorNumerico = Number.parseFloat(valor.replace(',', '.'));

    if (Number.isNaN(valorNumerico) || valorNumerico <= 0) return;

    const novaConta: Conta = {
      id: criarIdLancamento(),
      descricao: descricao.trim(),
      valor: valorNumerico,
      categoria: categoriaSelecionada,
      data: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    };

    Keyboard.dismiss();
    setContas((anterior) => [novaConta, ...anterior]);
    setDescricao('');
    setValor('');
    setCategoriaSelecionada('Geral');
    mostrarMensagem('Conta adicionada');
  };

  const adicionarProvento = () => {
    if (!descricaoProvento.trim() || !provento.trim()) return;

    const valorNumerico = Number.parseFloat(provento.replace(',', '.'));

    if (Number.isNaN(valorNumerico) || valorNumerico <= 0) return;

    Keyboard.dismiss();
    setProventos((anterior) => [{
      id: criarIdLancamento(),
      descricao: descricaoProvento.trim(),
      valor: valorNumerico,
      data: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    }, ...anterior]);
    setDescricaoProvento('');
    setProvento('');
    mostrarMensagem('Provento adicionado');
  };

  const limparContas = () => {
    setContas([]);
  };

  const limparProventos = () => {
    setProventos([]);
  };

  const exportarBackup = async () => {
    const backup = JSON.stringify({
      app: 'meu-app-contas',
      version: 1,
      exportedAt: new Date().toISOString(),
      tituloRelatorio,
      contas,
      proventos,
    }, null, 2);

    try {
      if (window.desktopFiles) {
        const salvo = await window.desktopFiles.salvarBackup(backup);
        if (salvo) mostrarMensagem('Backup salvo');
        return;
      }

      const link = document.createElement('a');
      const url = URL.createObjectURL(new Blob([backup], { type: 'application/json' }));
      link.href = url;
      link.download = `meu-app-contas-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      mostrarMensagem('Backup baixado');
    } catch (error) {
      console.warn('Erro ao salvar backup:', error);
      mostrarMensagem('Não foi possível salvar o backup');
    }
  };

  const importarBackup = async () => {
    try {
      const conteudo = window.desktopFiles
        ? await window.desktopFiles.abrirBackup()
        : await new Promise<string | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json,application/json';
          input.onchange = () => {
            const arquivo = input.files?.[0];
            if (!arquivo) {
              resolve(null);
              return;
            }
            void arquivo.text().then(resolve).catch(() => resolve(null));
          };
          input.click();
        });

      if (!conteudo) return;
      const dados = JSON.parse(conteudo) as Record<string, unknown>;
      if (
        dados.app !== 'meu-app-contas' ||
        dados.version !== 1 ||
        !isListaContasValida(dados.contas) ||
        !isListaProventosValida(dados.proventos) ||
        typeof dados.tituloRelatorio !== 'string'
      ) {
        mostrarMensagem('Arquivo de backup inválido');
        return;
      }

      if (!window.confirm('Substituir os dados atuais pelo conteúdo deste backup?')) return;
      setContas(dados.contas);
      setProventos(dados.proventos);
      setTituloRelatorio(dados.tituloRelatorio);
      mostrarMensagem('Backup restaurado');
    } catch (error) {
      console.warn('Erro ao restaurar backup:', error);
      mostrarMensagem('Não foi possível ler o backup');
    }
  };

  const abrirFiltro = () => setFiltroAberto((atual) => !atual);

  const gerarRelatorio = async () => {
    const totalContas = contas.reduce((acumulador, conta) => acumulador + conta.valor, 0);
    const saldoRelatorio = totalProventos - totalContas;
    const titulo = tituloRelatorio.trim() || 'Minhas contas';
    const proventosHtml = proventos.length
      ? proventos.map((item) => `<tr><td>${escapeHtml(item.data)}</td><td>${escapeHtml(item.descricao)}</td><td>${formatCurrency(item.valor)}</td></tr>`).join('')
      : '<tr><td colspan="3">Nenhum provento registrado</td></tr>';
    const contasHtml = contas.length
      ? contas.map((item) => `<tr><td>${escapeHtml(item.data)}</td><td>${escapeHtml(item.descricao)}</td><td>${escapeHtml(item.categoria)}</td><td>${formatCurrency(item.valor)}</td></tr>`).join('')
      : '<tr><td colspan="4">Nenhuma conta registrada</td></tr>';

    const html = `
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #172033; padding: 32px; }
            h1 { color: #1d4ed8; margin-bottom: 4px; }
            h2 { color: #173baf; margin-top: 28px; }
            .date { color: #64748b; margin-bottom: 24px; }
            .summary { display: flex; gap: 12px; margin: 20px 0; }
            .card { flex: 1; padding: 14px; border: 1px solid #dbe4f0; border-radius: 8px; }
            .label { display: block; color: #64748b; font-size: 12px; margin-bottom: 6px; }
            .value { font-size: 20px; font-weight: bold; }
            .negative { color: #dc2626; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; }
            th { background: #eff6ff; color: #1e40af; }
            td:last-child, th:last-child { text-align: right; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(titulo)}</h1>
          <div class="date">Relatório financeiro completo</div>
          <div class="summary">
            <div class="card"><span class="label">Proventos</span><span class="value">${formatCurrency(totalProventos)}</span></div>
            <div class="card"><span class="label">Gastos</span><span class="value">${formatCurrency(totalContas)}</span></div>
            <div class="card"><span class="label">Saldo restante</span><span class="value ${saldoRelatorio < 0 ? 'negative' : ''}">${formatCurrency(saldoRelatorio)}</span></div>
          </div>
          <h2>Proventos detalhados</h2>
          <table><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${proventosHtml}</tbody></table>
          <h2>Gastos detalhados</h2>
          <table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr></thead><tbody>${contasHtml}</tbody></table>
        </body>
      </html>
    `;

    try {
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }

      const arquivo = await Print.printToFileAsync({ html });
      const compartilhamentoDisponivel = await Sharing.isAvailableAsync();

      if (compartilhamentoDisponivel) {
        const uriCompartilhavel = Platform.OS === 'android'
          ? await FileSystem.getContentUriAsync(arquivo.uri)
          : arquivo.uri;

        await Sharing.shareAsync(uriCompartilhavel, {
          mimeType: 'application/pdf',
          dialogTitle: 'Compartilhar relatório em PDF',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Relatório gerado', 'O PDF foi criado, mas o compartilhamento não está disponível neste dispositivo.');
      }
    } catch (error) {
      console.warn('Erro ao gerar relatório em PDF:', error);
      Alert.alert('Erro', 'Não foi possível gerar o relatório em PDF.');
    }
  };

  const donutColors = ['#2f5ef7', '#1d9c72', '#f2994a', '#d94a4a'];
  const donutSegments = resumoPorCategoria.slice(0, 4).map((item, index) => ({
    ...item,
    color: donutColors[index % donutColors.length],
  }));
  const barColors = ['#2f5ef7', '#22c55e', '#f59e0b', '#ef4444', '#a78bfa'];
  const categoriaMaisAlta = resumoPorCategoria[0];
  const percentualGasto = totalProventos > 0 ? Math.min((total / totalProventos) * 100, 100) : total > 0 ? 100 : 0;
  const percentualSaldo = totalProventos > 0 ? Math.max(100 - percentualGasto, 0) : 0;
  const gastoRotacao = percentualGasto > 0 ? (percentualGasto / 100) * 360 : 0;
  const ringRadius = 48;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const gastoLength = (percentualGasto / 100) * ringCircumference;
  const saldoLength = ringCircumference - gastoLength;

  return (
    <View style={styles.screenWrapper}>
      {mensagem ? (
        <View pointerEvents="none" style={styles.toast}>
          <Icon name="check-circle-outline" size={18} color="#bbf7d0" />
          <Text style={styles.toastText}>{mensagem}</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => {
          Keyboard.dismiss();
          setFiltroAberto(false);
        }}
      >
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Icon name="wallet-outline" size={28} color="#2f5ef7" />
              <Text style={styles.eyebrow}>Dashboard</Text>
            </View>

        <View style={styles.headerTitleRow}>
              <TextInput
                style={styles.titleInput}
                value={tituloRelatorio}
                onChangeText={setTituloRelatorio}
                placeholder="Minhas contas"
                placeholderTextColor="#f8fbff"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={[styles.sectionIconBadge, styles.proventoIconBadge]}>
              <Icon name="cash-plus" size={18} color="#60a5fa" />
            </View>
            <Text style={styles.summaryLabel}>Proventos</Text>
          </View>
          <Text style={styles.summaryMinor}>{formatCurrency(totalProventos)}</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={[styles.sectionIconBadge, styles.summaryIconBadge]}>
              <Icon name="cash-multiple" size={18} color="#ffffff" />
            </View>
            <Text style={styles.summaryLabel}>Gastos</Text>
          </View>
          <Text style={styles.summaryMinor}>{formatCurrency(total)}</Text>
        </View>
      </View>

          <View style={styles.balanceRow}>
            <View style={[styles.balanceCard, saldoRestante < 0 && styles.balanceCardNegative]}>
              <Text style={styles.balanceLabel}>Saldo restante</Text>
              <Text style={[styles.balanceValue, saldoRestante < 0 && styles.balanceValueNegative]}>
                {formatCurrency(saldoRestante)}
              </Text>
            </View>

            <View style={styles.actionColumn}>
              <TouchableOpacity style={styles.reportButton} onPress={gerarRelatorio} activeOpacity={0.9}>
                <View style={styles.buttonContent}>
                  <Icon name="file-document-outline" size={18} color="#eaf2ff" />
                  <Text style={styles.reportButtonText}>Relatório</Text>
                </View>
              </TouchableOpacity>

              {Platform.OS === 'web' && (
                <>
                  <TouchableOpacity
                    accessibilityLabel="Salvar backup dos dados"
                    style={styles.fileActionButton}
                    onPress={exportarBackup}
                  >
                    <View style={styles.buttonContent}>
                      <Icon name="content-save-outline" size={17} color="#dfeafc" />
                      <Text style={styles.fileActionText}>Backup</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    accessibilityLabel="Restaurar dados de um backup"
                    style={styles.fileActionButton}
                    onPress={importarBackup}
                  >
                    <View style={styles.buttonContent}>
                      <Icon name="backup-restore" size={17} color="#dfeafc" />
                      <Text style={styles.fileActionText}>Restaurar</Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  limparContas();
                }}
                style={styles.clearButton}
              >
                <View style={styles.buttonContent}>
                  <Icon name="delete-outline" size={18} color="#ffffff" />
                  <Text style={styles.clearButtonText}>Limpar</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.pieCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconBadge, styles.distributionIconBadge]}>
                <Icon name="chart-donut" size={18} color="#60a5fa" />
              </View>
              <Text style={styles.sectionTitle}>Distribuição</Text>
            </View>

            <View style={styles.pieLayoutSimple}>
              <View style={styles.chartRingWrap}>
                <Svg width={130} height={130} viewBox="0 0 120 120">
                  <Circle
                    cx="60"
                    cy="60"
                    r={ringRadius}
                    stroke="#22c55e"
                    strokeWidth={14}
                    fill="none"
                    strokeDasharray={`${Math.max(saldoLength, 0)} ${ringCircumference}`}
                    strokeDashoffset={0}
                    strokeLinecap="round"
                    rotation={-90}
                    originX={60}
                    originY={60}
                  />
                  <Circle
                    cx="60"
                    cy="60"
                    r={ringRadius}
                    stroke="#ef4444"
                    strokeWidth={14}
                    fill="none"
                    strokeDasharray={`${Math.max(gastoLength, 0)} ${ringCircumference}`}
                    strokeDashoffset={-Math.max(saldoLength, 0)}
                    strokeLinecap="round"
                    rotation={-90}
                    originX={60}
                    originY={60}
                  />
                  <Circle cx="60" cy="60" r="30" fill="#081621" />
                </Svg>
                <View style={styles.ringInner}>
                  <Text style={styles.ringValue}>{Math.round(percentualGasto)}%</Text>
                </View>
              </View>

              <View style={styles.legendList}>
                <View style={styles.legendHighlight}>
                  <Text style={styles.legendHighlightLabel}>Maior despesa</Text>
                  <Text style={styles.legendHighlightValue}>
                    {categoriaMaisAlta ? categoriaMaisAlta.categoria : 'Sem dados'}
                  </Text>
                </View>

                {donutSegments[0] && (
                  <View style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: donutSegments[0].color }]} />
                    <Text style={styles.legendText}>{donutSegments[0].categoria}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.filterCard}>
            <View style={styles.filterHeaderRow}>
              <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionIconBadge, styles.filterIconBadge]}>
                  <Icon name="filter-outline" size={18} color="#60a5fa" />
                </View>
                <Text style={styles.sectionTitle}>Filtrar por categoria</Text>
              </View>

              {categoriaFiltro !== 'Todas' && (
                <TouchableOpacity onPress={() => setCategoriaFiltro('Todas')} style={styles.filterResetButton}>
                  <Text style={styles.filterResetText}>Limpar</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.filterSelector}
              onPress={(event) => {
                event.stopPropagation();
                Keyboard.dismiss();
                abrirFiltro();
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.filterSelectorText}>{categoriaFiltro}</Text>
              <Icon name={filtroAberto ? 'chevron-up' : 'chevron-down'} size={18} color="#dfeafc" />
            </TouchableOpacity>

            {filtroAberto && (
              <View style={styles.filterMenu}>
                {categoriasFiltro.map((categoria) => {
                  const ativo = categoria === categoriaFiltro;
                  const quantidade = categoria === 'Todas' ? contas.length : contagemPorCategoria[categoria] ?? 0;

                  return (
                    <TouchableOpacity
                      key={categoria}
                      onPress={(event) => {
                        event.stopPropagation();
                        setCategoriaFiltro(categoria);
                        setFiltroAberto(false);
                      }}
                      style={[styles.filterMenuItem, ativo && styles.filterMenuItemActive]}
                    >
                      <Text style={[styles.filterMenuText, ativo && styles.filterMenuTextActive]}>{categoria}</Text>
                      <View style={[styles.countBadge, ativo && styles.countBadgeActive]}>
                        <Text style={[styles.countBadgeText, ativo && styles.countBadgeTextActive]}>{quantidade}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.chartCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconBadge, styles.chartIconBadge]}>
                <Icon name="chart-bar" size={18} color="#60a5fa" />
              </View>
              <Text style={styles.sectionTitle}>Resumo por categoria</Text>
            </View>
            {resumoPorCategoria.length === 0 ? (
              <Text style={styles.emptyChartText}>Nenhuma categoria para mostrar.</Text>
            ) : (
              resumoPorCategoria.map((item, index) => (
                <View key={item.categoria} style={styles.chartRow}>
                  <View style={styles.chartMetaRow}>
                    <View style={styles.chartLabelWrap}>
                      <View style={[styles.chartDot, { backgroundColor: barColors[index % barColors.length] }]} />
                      <Text style={styles.chartLabel}>{item.categoria}</Text>
                    </View>
                    <Text style={styles.chartValue}>{formatCurrency(item.valor)}</Text>
                  </View>

                  <View style={styles.chartTrack}>
                    <View
                      style={[
                        styles.chartFill,
                        {
                          width: `${item.percentual}%`,
                          backgroundColor: barColors[index % barColors.length],
                        },
                      ]}
                    />
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.ledgerCard}>
            <View style={styles.listHeader}>
              <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionIconBadge, styles.listIconBadge]}>
                  <Icon name="format-list-bulleted" size={18} color="#60a5fa" />
                </View>
                <Text style={styles.sectionTitle}>Lançamentos</Text>
              </View>
              <Text style={styles.counter}>{lancamentosFiltrados.length} itens</Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Buscar descrição, categoria ou data"
              value={buscaLancamentos}
              onChangeText={setBuscaLancamentos}
              placeholderTextColor="#8993a4"
            />

            {lancamentosFiltrados.length === 0 ? (
              <Text style={styles.emptyLedgerText}>
                {contas.length + proventos.length ? 'Nenhum lançamento encontrado.' : 'Seus lançamentos aparecerão aqui.'}
              </Text>
            ) : lancamentosFiltrados.map((item) => (
              <View key={`${item.tipo}-${item.id}`} style={styles.ledgerRow}>
                <View style={styles.itemMain}>
                  <Text style={styles.ledgerDescription}>{item.descricao}</Text>
                  <Text style={styles.ledgerMeta}>{item.data}  ·  {item.categoria}</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={[styles.ledgerAmount, item.tipo === 'Provento' && styles.ledgerIncome]}>
                    {item.tipo === 'Provento' ? '+' : '-'}{formatCurrency(item.valor)}
                  </Text>
                  <TouchableOpacity
                    accessibilityLabel={`Remover ${item.descricao}`}
                    onPress={() => removerLancamento(item.tipo as 'Gasto' | 'Provento', item.id)}
                    style={styles.ledgerRemoveButton}
                  >
                    <Icon name="delete-outline" size={18} color="#fca5a5" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.formCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconBadge, styles.proventoFormIconBadge]}>
                <Icon name="cash-plus" size={18} color="#4ade80" />
              </View>
              <Text style={styles.sectionTitle}>Adicionar provento</Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Descrição do provento"
              value={descricaoProvento}
              onChangeText={setDescricaoProvento}
              placeholderTextColor="#8993a4"
            />

            <TextInput
              style={styles.input}
              placeholder="Valor do provento"
              value={provento}
              onChangeText={setProvento}
              keyboardType="decimal-pad"
              placeholderTextColor="#8993a4"
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.button, styles.halfButton]} onPress={adicionarProvento}>
                <View style={styles.buttonContent}>
                  <Icon name="plus-circle-outline" size={18} color="#ffffff" />
                  <Text style={styles.buttonText}>Adicionar</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.clearButton, styles.halfButton]} onPress={limparProventos}>
                <View style={styles.buttonContent}>
                  <Icon name="restart" size={18} color="#ffffff" />
                  <Text style={styles.clearButtonText}>Zerar</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionIconBadge, styles.accountFormIconBadge]}>
                <Icon name="plus-box-outline" size={18} color="#34d399" />
              </View>
              <Text style={styles.sectionTitle}>Adicionar conta</Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Descrição"
              value={descricao}
              onChangeText={setDescricao}
              placeholderTextColor="#8993a4"
            />

            <TextInput
              style={styles.input}
              placeholder="Valor"
              value={valor}
              onChangeText={setValor}
              keyboardType="decimal-pad"
              placeholderTextColor="#8993a4"
            />

            <TouchableOpacity
              style={styles.filterSelector}
              onPress={(event) => {
                event.stopPropagation();
                Keyboard.dismiss();
                setCategoriaCadastroAberta((atual) => !atual);
              }}
              activeOpacity={0.9}
            >
              <Text style={styles.filterSelectorText}>{categoriaSelecionada}</Text>
              <Icon name={categoriaCadastroAberta ? 'chevron-up' : 'chevron-down'} size={18} color="#dfeafc" />
            </TouchableOpacity>

            {categoriaCadastroAberta && (
              <View style={styles.filterMenu}>
                {categoriasCadastro.map((categoria) => {
                  const ativo = categoria === categoriaSelecionada;

                  return (
                    <TouchableOpacity
                      key={categoria}
                      onPress={(event) => {
                        event.stopPropagation();
                        setCategoriaSelecionada(categoria);
                        setCategoriaCadastroAberta(false);
                      }}
                      style={[styles.filterMenuItem, ativo && styles.filterMenuItemActive]}
                    >
                      <Text style={[styles.filterMenuText, ativo && styles.filterMenuTextActive]}>{categoria}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity style={styles.button} onPress={adicionarConta}>
              <View style={styles.buttonContent}>
                <Icon name="plus-circle-outline" size={18} color="#ffffff" />
                <Text style={styles.buttonText}>Adicionar conta</Text>
              </View>
            </TouchableOpacity>
          </View>

        </ScrollView>
        <View pointerEvents="none" style={styles.watermark}>
          <Text style={styles.watermarkText}>Designed by D-TecLog</Text>
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: '#07131f',
  },
  toast: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#14532d',
    borderWidth: 1,
    borderColor: '#4ade80',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  toastText: {
    color: '#f0fdf4',
    fontSize: 14,
    fontWeight: '800',
  },
  container: {
    flex: 1,
    backgroundColor: '#07131f',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 48,
  },
  watermark: {
    position: 'absolute',
    right: 14,
    bottom: 10,
    zIndex: 1,
  },
  watermarkText: {
    color: '#9fb3d8',
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.48,
  },
  header: {
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#5b6b8a',
    fontWeight: '800',
  },
  title: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: '900',
    color: '#f8fbff',
    letterSpacing: -0.8,
    flexShrink: 1,
  },
  titleInput: {
    flex: 1,
    marginTop: 6,
    padding: 0,
    fontSize: 30,
    fontWeight: '900',
    color: '#f8fbff',
    letterSpacing: -0.8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 6,
  },
  reportButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1d4ed8',
    borderWidth: 1,
    borderColor: '#60a5fa',
  },
  reportButtonText: {
    color: '#eaf2ff',
    fontSize: 12,
    fontWeight: '800',
  },
  fileActionButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#182b40',
    borderWidth: 1,
    borderColor: '#38536f',
  },
  fileActionText: {
    color: '#dfeafc',
    fontSize: 11,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#0f1d2c',
    borderWidth: 1,
    borderColor: '#213b57',
    shadowColor: '#0b1728',
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  primaryCard: {
    backgroundColor: '#1d4ed8',
    borderColor: '#60a5fa',
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.35,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9fb3d8',
  },
  summaryLabelWhite: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  summaryMinor: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ecf3ff',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  actionColumn: {
    width: 116,
    gap: 6,
  },
  pieCard: {
    backgroundColor: '#0f1d2c',
    borderRadius: 18,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#213b57',
    shadowColor: '#091321',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  pieLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  pieLayoutSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryCompact: {
    display: 'none',
  },
  chartRingWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringShell: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#081621',
    shadowColor: '#22c55e',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
  },
  ringInner: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#081621',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#edf3ff',
  },
  legendList: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  legendHighlight: {
    backgroundColor: '#0f1d2c',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: '#213b57',
  },
  legendHighlightLabel: {
    fontSize: 10,
    color: '#8aa2c9',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  legendHighlightValue: {
    fontSize: 14,
    color: '#edf3ff',
    fontWeight: '800',
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 1,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: '#dfeafc',
    fontWeight: '700',
    flexShrink: 1,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: '#0f3b2d',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#34d399',
    shadowColor: '#22c55e',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#bbf7d0',
    fontWeight: '800',
    marginBottom: 6,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#f0fdf4',
  },
  balanceCardNegative: {
    backgroundColor: '#451a1a',
    borderColor: '#f87171',
    shadowColor: '#ef4444',
    shadowOpacity: 0.24,
  },
  balanceValueNegative: {
    color: '#fecaca',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#d94a4a',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#d94a4a',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  clearButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  filterCard: {
    backgroundColor: '#0f1d2c',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#213b57',
    shadowColor: '#091321',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  filterResetButton: {
    backgroundColor: '#eef3ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterResetText: {
    color: '#2f5ef7',
    fontSize: 11,
    fontWeight: '800',
  },
  chartCard: {
    backgroundColor: '#0d1a29',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1b2f45',
    shadowColor: '#07131f',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  chartRow: {
    marginBottom: 12,
  },
  chartMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  chartLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  chartDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartLabel: {
    fontSize: 12,
    color: '#edf3ff',
    fontWeight: '700',
  },
  chartValue: {
    fontSize: 11,
    color: '#9fb3d8',
    fontWeight: '700',
  },
  chartTrack: {
    height: 10,
    backgroundColor: '#14273a',
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 0,
  },
  chartFill: {
    height: '100%',
    borderRadius: 999,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  emptyChartText: {
    color: '#5b6b8a',
    fontSize: 13,
  },
  formCard: {
    backgroundColor: '#0f1d2c',
    borderRadius: 22,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#213b57',
    shadowColor: '#091321',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  distributionIconBadge: {
    backgroundColor: '#16263d',
    borderColor: '#2d4a75',
  },
  filterIconBadge: {
    backgroundColor: '#16263d',
    borderColor: '#2d4a75',
  },
  chartIconBadge: {
    backgroundColor: '#16263d',
    borderColor: '#2d4a75',
  },
  proventoIconBadge: {
    backgroundColor: '#0d2b22',
    borderColor: '#1c7f5b',
  },
  proventoFormIconBadge: {
    backgroundColor: '#0d2b22',
    borderColor: '#1c7f5b',
  },
  accountFormIconBadge: {
    backgroundColor: '#0d2b22',
    borderColor: '#1c7f5b',
  },
  listIconBadge: {
    backgroundColor: '#16263d',
    borderColor: '#2d4a75',
  },
  summaryIconBadge: {
    backgroundColor: '#1e3a8a',
    borderColor: '#60a5fa',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#edf3ff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#243653',
    backgroundColor: '#0d1b2d',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
    color: '#edf3ff',
  },
  filterSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a3f5f',
    backgroundColor: '#0d1b2d',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  filterSelectorText: {
    color: '#edf3ff',
    fontSize: 15,
    fontWeight: '700',
  },
  filterMenu: {
    backgroundColor: '#0d1b2d',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a3f5f',
    marginTop: 0,
    marginBottom: 12,
    overflow: 'hidden',
  },
  filterMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1b2f47',
  },
  filterMenuItemActive: {
    backgroundColor: '#142c4e',
  },
  filterMenuText: {
    color: '#dfeafc',
    fontSize: 14,
    fontWeight: '600',
  },
  filterMenuTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  categoryRow: {
    marginBottom: 16,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#24415e',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeActive: {
    backgroundColor: '#93c5fd',
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#eaf2ff',
  },
  countBadgeTextActive: {
    color: '#ffffff',
  },
  categoryTextActive: {
    color: '#173baf',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  button: {
    backgroundColor: '#1d9c72',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4ade80',
    shadowColor: '#1d9c72',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  halfButton: {
    flex: 1,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ledgerCard: {
    backgroundColor: '#0f1d2c',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#213b57',
  },
  counter: {
    color: '#9fb3d8',
    fontSize: 12,
    fontWeight: '700',
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1b2f45',
    borderBottomWidth: 0,
  },
  itemMain: {
    flex: 1,
    marginRight: 12,
  },
  ledgerDescription: {
    fontSize: 14,
    fontWeight: '700',
    color: '#edf3ff',
    marginBottom: 4,
  },
  ledgerMeta: {
    fontSize: 11,
    color: '#8aa2c9',
    fontWeight: '600',
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  ledgerAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fca5a5',
    marginBottom: 4,
  },
  ledgerIncome: {
    color: '#4ade80',
  },
  ledgerRemoveButton: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#3b2028',
  },
  emptyLedgerText: {
    color: '#8aa2c9',
    fontSize: 13,
    paddingVertical: 12,
  },
});
