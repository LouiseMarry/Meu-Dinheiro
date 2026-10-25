
const dinheiro = valor =>
  (Number(valor) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

// ELEMENTOS DO APLICATIVO

const mes = document.getElementById("mes");
const salario = document.getElementById("salario");
const vt = document.getElementById("vt");
const quantidadeParcelas = document.getElementById("quantidadeParcelas");
// O VT é editável e independente para cada mês.
vt.readOnly = false;
const totalDespesas = document.getElementById("totalDespesas");
const saldo = document.getElementById("saldo");
const faltaPagar = document.getElementById("faltaPagar");
const formulario = document.getElementById("formDespesa");
const lista = document.getElementById("listaDespesas");

const CHAVE = "meu-dinheiro-dados-v1";

let despesas = [];
let dadosPorMes = {};
let mesAtual = "";
let edicao = null;
const botaoSalvar = formulario.querySelector('button[type="submit"]');

// RECUPERAR OS DADOS ARMAZENADOS

function carregarDados() {
  try {
    const dadosSalvos = localStorage.getItem(CHAVE);

    const resultado = dadosSalvos
      ? JSON.parse(dadosSalvos)
      : {};

    dadosPorMes =
      resultado &&
      typeof resultado === "object" &&
      !Array.isArray(resultado)
        ? resultado
        : {};

    console.log("Dados recuperados:", dadosPorMes);
  } catch (erro) {
    console.error("Erro ao carregar dados:", erro);
    dadosPorMes = {};
  }
}

// SALVAR TODOS OS DADOS DO MÊS

function salvarDados() {
  if (!mesAtual) return;

  dadosPorMes[mesAtual] = {
    salario: salario.value,
    vt: vt.value,
    despesas: despesas.map(conta => ({ ...conta }))
  };

  try {
    localStorage.setItem(
      CHAVE,
      JSON.stringify(dadosPorMes)
    );

    console.log("Dados salvos com sucesso!", mesAtual);
  } catch (erro) {
    console.error("Erro ao salvar dados:", erro);
    alert("Não foi possível salvar seus dados.");
  }
}

// MOSTRAR OS DADOS DO MÊS SELECIONADO

function carregarMes() {
  mesAtual = mes.value;

  const dados = dadosPorMes[mesAtual] || {
    salario: "",
    vt: "",
    despesas: []
  };

  salario.value = dados.salario ?? "";
  vt.value = dados.vt ?? "";

  despesas = Array.isArray(dados.despesas)
    ? dados.despesas.map(conta => ({ ...conta }))
    : [];

  fecharFormulario();
  renderizarDespesas();
}

// RECALCULAR RESUMO

function atualizarResumo() {
  const total = despesas.reduce(
    (soma, conta) => soma + (Number(conta.valor) || 0),
    0
  );

  totalDespesas.textContent = dinheiro(total);
  // Pagamento reduz a dívida pendente, nunca aumenta o saldo disponível.
  const pendente = despesas.reduce((soma, conta) =>
    soma + (conta.pago === true ? 0 : (Number(conta.valor) || 0)), 0);
  faltaPagar.textContent = "Falta pagar: " + dinheiro(pendente);

  saldo.textContent = dinheiro(
    (Number(salario.value) || 0) - total
  );
}

// Identifica parcelas atuais e antigas sem apagar compras não relacionadas.
function identificarParcelas(conta) {
  if (conta.parcelamentoId) {
    return { id: conta.parcelamentoId };
  }
  // Compatibilidade com parcelas mais antigas, sem identificador.
  const identificacao = /^(.*) \((\d+)\/(\d+)\)$/.exec(conta.nome);
  if (!identificacao) return null;
  const [, nome, numeroTexto, totalTexto] = identificacao;
  const numero = Number(numeroTexto);
  const total = Number(totalTexto);
  if (!nome || total < 2 || numero < 1 || numero > total) return null;
  const inicio = adicionarMeses(mesAtual, 1 - numero);
  const grupo = { nome, total, inicio, categoria: conta.categoria, valor: Number(conta.valor), antigo: true };
  // Só agrupa registros antigos se existir outra parcela compatível.
  let encontradas = 0;
  for (const [chave, dados] of Object.entries(dadosPorMes)) {
    for (const item of (dados.despesas || [])) {
      if (pertenceAoGrupo(item, chave, grupo)) encontradas++;
    }
  }
  return encontradas > 0 ? grupo : null;
}

function pertenceAoGrupo(item, chaveMes, grupo) {
  if (grupo.id) return item.parcelamentoId === grupo.id;
  if (item.parcelamentoId) return false;
  if (item.categoria !== grupo.categoria || Number(item.valor) !== grupo.valor) return false;
  for (let i = 0; i < grupo.total; i++) {
    if (chaveMes === adicionarMeses(grupo.inicio, i) &&
        item.nome === grupo.nome + " (" + (i + 1) + "/" + grupo.total + ")") {
      return true;
    }
  }
  return false;
}

// Painel de escolha exibido somente ao excluir compras parceladas.
// Usa os tons já existentes, sem alterar CSS ou os cartões do aplicativo.
function escolherExclusaoParcela(conta, excluirUnica, excluirTodas) {
  const fundo = document.createElement("div");
  fundo.setAttribute("role", "presentation");
  fundo.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.48);display:flex;align-items:center;justify-content:center;padding:20px;";

  const painel = document.createElement("div");
  painel.setAttribute("role", "dialog");
  painel.setAttribute("aria-modal", "true");
  painel.setAttribute("aria-label", "Excluir compra parcelada");
  painel.style.cssText = "width:min(100%,390px);background:#fff;border-radius:20px;padding:24px;box-shadow:0 12px 40px rgba(0,0,0,.2);color:#29372f;font-family:inherit;";

  const titulo = document.createElement("h3");
  titulo.textContent = "Excluir compra parcelada?";
  titulo.style.cssText = "margin:0 0 10px;font-size:19px;";

  const explicacao = document.createElement("p");
  explicacao.textContent = conta.nome + " — escolha o que deseja remover:";
  explicacao.style.cssText = "margin:0 0 20px;font-size:14px;line-height:1.5;color:#606c64;";

  const escolhas = document.createElement("div");
  escolhas.style.cssText = "display:flex;flex-direction:column;gap:10px;";

  const criarBotao = (rotulo, fundoBotao, textoBotao, acao) => {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = rotulo;
    botao.style.cssText = "width:100%;padding:13px;border:0;border-radius:12px;font-weight:600;background:" + fundoBotao + ";color:" + textoBotao + ";cursor:pointer;";
    botao.addEventListener("click", () => {
      fundo.remove();
      document.removeEventListener("keydown", fecharEscape);
      if (acao) acao();
    });
    return botao;
  };
  const fecharEscape = evento => {
    if (evento.key === "Escape") {
      fundo.remove();
      document.removeEventListener("keydown", fecharEscape);
    }
  };
  fundo.addEventListener("click", evento => {
    if (evento.target === fundo) fundo.remove();
  });
  escolhas.append(
    criarBotao("Excluir somente esta parcela", "#e5eee5", "#263e33", excluirUnica),
    criarBotao("Excluir todas as parcelas", "#803e36", "#fff", excluirTodas),
    criarBotao("Cancelar", "#eceee9", "#29372f", null)
  );
  painel.append(titulo, explicacao, escolhas);
  fundo.append(painel);
  document.body.append(fundo);
  document.addEventListener("keydown", fecharEscape);
}

function excluirContaDoMes(indice) {
  const copia = JSON.parse(JSON.stringify(dadosPorMes));
  copia[mesAtual] = {
    salario: salario.value,
    vt: vt.value,
    despesas: despesas.filter((_, i) => i !== indice).map(item => ({ ...item }))
  };
  gravarExclusao(copia);
}

function excluirCompraDeTodosMeses(grupo) {
  const copia = JSON.parse(JSON.stringify(dadosPorMes));
  copia[mesAtual] = {
    salario: salario.value,
    vt: vt.value,
    despesas: despesas.map(item => ({ ...item }))
  };
  for (const [chaveMes, dados] of Object.entries(copia)) {
    if (!Array.isArray(dados.despesas)) continue;
    dados.despesas = dados.despesas.filter(
      item => !pertenceAoGrupo(item, chaveMes, grupo)
    );
  }
  gravarExclusao(copia);
}

function gravarExclusao(copia) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(copia));
    dadosPorMes = copia;
    despesas = copia[mesAtual]?.despesas || [];
    renderizarDespesas();
  } catch (erro) {
    console.error("Erro ao excluir despesa:", erro);
    alert("Não foi possível salvar a exclusão. Nenhuma conta foi removida.");
  }
}

// MOSTRAR LISTA DE DESPESAS
// MANTÉM AS CLASSES E ESTILOS ORIGINAIS

function renderizarDespesas() {
  lista.className = "";
  lista.replaceChildren();

  if (despesas.length === 0) {
    lista.className = "lista-vazia";

    const icone = document.createElement("div");
    icone.className = "icone-vazio";
    icone.textContent = "♡";

    const titulo = document.createElement("h3");
    titulo.textContent = "Nenhuma conta por aqui";

    const descricao = document.createElement("p");
    descricao.textContent =
      "Adicione sua primeira despesa para começar.";

    lista.append(icone, titulo, descricao);

    atualizarResumo();
    return;
  }

  despesas.forEach((conta, indice) => {
    const item = document.createElement("article");

    item.style.cssText =
      "display:flex;align-items:center;gap:12px;padding:16px 0;border-bottom:1px solid #eee;";

    const detalhes = document.createElement("div");
    detalhes.style.flex = "1";

    const pago = conta.pago === true;
    item.style.background = pago ? "#e5eee5" : "#f9e9e7";
    item.style.borderLeft = pago ? "4px solid #3b7952" : "4px solid #ba534d";
    item.style.borderRadius = "10px";
    item.style.padding = "12px";

    const marcarPago = document.createElement("input");
    marcarPago.type = "checkbox";
    marcarPago.checked = pago;
    marcarPago.setAttribute("aria-label", "Marcar " + conta.nome + " como paga");
    marcarPago.style.cssText = "width:20px;height:20px;flex-shrink:0;accent-color:#3b7952;cursor:pointer;";
    marcarPago.addEventListener("change", () => {
      const anterior = despesas[indice].pago;
      despesas[indice].pago = marcarPago.checked;
      try {
        salvarDados();
        renderizarDespesas();
      } catch (erro) {
        despesas[indice].pago = anterior;
        marcarPago.checked = anterior === true;
      }
    });

    const nome = document.createElement("strong");
    nome.textContent = conta.nome;

    const info = document.createElement("p");

    info.style.cssText =
      "margin:6px 0 0;color:#788078;font-size:12px;";

    info.textContent = `${pago ? "✓ Paga" : "Pendente"} · ${conta.categoria} · ${
      conta.vencimento
        ? new Date(
            conta.vencimento + "T12:00:00"
          ).toLocaleDateString("pt-BR")
        : "Sem vencimento"
    }`;

    const valor = document.createElement("strong");
    valor.textContent = dinheiro(conta.valor);

    const editar = document.createElement("button");
    editar.type = "button";
    editar.textContent = "Editar";
    editar.setAttribute("aria-label", "Editar " + conta.nome);
    editar.style.cssText =
      "padding:8px 10px;background:#e5eee5;color:#263e33;font-size:12px;";
    editar.addEventListener("click", () => abrirEdicao(conta, indice));

    const remover = document.createElement("button");
    remover.type = "button";
    remover.textContent = "×";

    remover.setAttribute(
      "aria-label",
      `Excluir ${conta.nome}`
    );

    remover.style.padding = "8px 12px";
    remover.style.background = "#f4e4e1";
    remover.style.color = "#803e36";

    remover.addEventListener("click", () => {
      const grupo = identificarParcelas(conta);
      if (grupo) {
        escolherExclusaoParcela(
          conta,
          () => excluirContaDoMes(indice),
          () => excluirCompraDeTodosMeses(grupo)
        );
      } else if (window.confirm("Excluir esta despesa?")) {
        excluirContaDoMes(indice);
      }
    });

    detalhes.append(nome, info);
    item.append(marcarPago, detalhes, valor, editar, remover);
    lista.append(item);
  });

  atualizarResumo();
}

// ABRIR E FECHAR FORMULÁRIO
function fecharFormulario() {
  edicao = null;
  formulario.reset();
  formulario.hidden = true;
  if (botaoSalvar) botaoSalvar.textContent = "Salvar conta";
}

function nomeSemParcela(conta) {
  if (!conta.parcelamentoId || !conta.parcelasTotal) return conta.nome;
  const sufixo = " (" + conta.parcelaNumero + "/" + conta.parcelasTotal + ")";
  return conta.nome.endsWith(sufixo)
    ? conta.nome.slice(0, -sufixo.length)
    : conta.nome;
}

function abrirEdicao(conta, indice) {
  // Usa o início original da compra mesmo ao editar a parcela de outro mês.
  const numero = Number(conta.parcelaNumero) || 1;
  const mesInicio = adicionarMeses(mesAtual, 1 - numero);
  edicao = {
    indice,
    mesSelecionado: mesAtual,
    id: conta.parcelamentoId || null,
    mesInicio: conta.parcelamentoId ? mesInicio : mesAtual
  };
  document.getElementById("nomeDespesa").value = nomeSemParcela(conta);
  document.getElementById("categoria").value = conta.categoria;
  document.getElementById("valorDespesa").value = conta.valor;
  quantidadeParcelas.value = conta.parcelasTotal || 1;
  // Recupera o dia de vencimento da primeira parcela, quando existir.
  const primeiro = edicao.id
    ? (dadosPorMes[edicao.mesInicio]?.despesas || []).find(
        item => item.parcelamentoId === edicao.id
      )
    : conta;
  document.getElementById("vencimento").value =
    primeiro?.vencimento || conta.vencimento || "";
  if (botaoSalvar) botaoSalvar.textContent = "Salvar alterações";
  formulario.hidden = false;
  document.getElementById("nomeDespesa").focus();
}

// ABRIR FORMULÁRIO DE DESPESA

document.getElementById("novaDespesa")
  .addEventListener("click", () => {
    fecharFormulario();
    formulario.hidden = false;
    document.getElementById("nomeDespesa").focus();
  });

// CANCELAR NOVA DESPESA

document.getElementById("cancelar")
  .addEventListener("click", () => {
    fecharFormulario();
  });

// SOMAR MESES SEM MISTURAR O HISTÓRICO OU O ANO
function adicionarMeses(chaveMes, quantidade) {
  const [ano, numeroMes] = chaveMes.split("-").map(Number);
  const data = new Date(Date.UTC(ano, numeroMes - 1 + quantidade, 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Manter o dia de vencimento quando possível (ex.: dia 31 vira dia 28 em fevereiro).
function vencimentoDaParcela(vencimento, chaveMes) {
  if (!vencimento) return "";
  const dia = Number(vencimento.slice(8, 10));
  const [ano, numeroMes] = chaveMes.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, numeroMes, 0)).getUTCDate();
  return `${chaveMes}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`;
}

// Criar as parcelas consecutivas, preservando a data e a virada de ano.
function criarParcelas(valores, inicio, id) {
  const registros = [];
  for (let i = 0; i < valores.parcelas; i++) {
    const chave = adicionarMeses(inicio, i);
    const conta = {
      nome: valores.parcelas > 1
        ? valores.nome + " (" + (i + 1) + "/" + valores.parcelas + ")"
        : valores.nome,
      categoria: valores.categoria,
      valor: valores.valor,
      vencimento: vencimentoDaParcela(valores.vencimento, chave)
    };
    if (id) {
      conta.parcelamentoId = id;
      conta.parcelaNumero = i + 1;
      conta.parcelasTotal = valores.parcelas;
    }
    registros.push([chave, conta]);
  }
  return registros;
}

function editarParcelamento(valores) {
  // Criamos uma cópia de todo o histórico antes de gravar: nenhuma
  // outra conta, salário ou VT será modificado.
  const copia = JSON.parse(JSON.stringify(dadosPorMes));
  copia[mesAtual] = {
    salario: salario.value,
    vt: vt.value,
    despesas: despesas.map(item => ({ ...item }))
  };
  // Guardar o estado de pagamento de cada mês ao editar a compra.
  const pagamentosAnteriores = new Map();
  if (edicao.id) {
    for (const [chave, dados] of Object.entries(copia)) {
      for (const item of (dados.despesas || [])) {
        if (item.parcelamentoId === edicao.id) {
          pagamentosAnteriores.set(chave, item.pago === true);
        }
      }
    }
  } else {
    pagamentosAnteriores.set(edicao.mesSelecionado,
      copia[edicao.mesSelecionado].despesas[edicao.indice]?.pago === true);
  }
  if (edicao.id) {
    for (const dados of Object.values(copia)) {
      if (Array.isArray(dados.despesas)) {
        dados.despesas = dados.despesas.filter(
          item => item.parcelamentoId !== edicao.id
        );
      }
    }
  } else {
    copia[edicao.mesSelecionado].despesas.splice(edicao.indice, 1);
  }

  const id = edicao.id || (valores.parcelas > 1
    ? "parcela-" + Date.now() + "-" + Math.random().toString(36).slice(2)
    : null);

  for (const [chaveMes, conta] of criarParcelas(valores, edicao.mesInicio, id)) {
    conta.pago = pagamentosAnteriores.get(chaveMes) === true;
    if (!copia[chaveMes]) {
      copia[chaveMes] = { salario: "", vt: "", despesas: [] };
    }
    if (!Array.isArray(copia[chaveMes].despesas)) {
      copia[chaveMes].despesas = [];
    }
    copia[chaveMes].despesas.push(conta);
  }

  try {
    localStorage.setItem(CHAVE, JSON.stringify(copia));
  } catch (erro) {
    console.error("Erro ao salvar alterações:", erro);
    alert("Não foi possível salvar a edição. Nenhuma alteração foi aplicada.");
    return false;
  }
  dadosPorMes = copia;
  despesas = copia[mesAtual]?.despesas || [];
  return true;
}

// CADASTRAR E SALVAR DESPESA

formulario.addEventListener("submit", evento => {
  evento.preventDefault();

  const nome = document.getElementById("nomeDespesa")
    .value.trim();

  const categoria =
    document.getElementById("categoria").value;

  const valor = Number(
    document.getElementById("valorDespesa").value
  );

  const vencimento =
    document.getElementById("vencimento").value;

  if (!nome || !Number.isFinite(valor) || valor <= 0) {
    alert("Confira o nome e o valor da despesa.");
    return;
  }

  const parcelas = Number(quantidadeParcelas.value);
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 120) {
    alert("Informe uma quantidade entre 1 e 120 meses.");
    return;
  }

  if (edicao) {
    const atualizado = editarParcelamento({
      nome, categoria, valor, vencimento, parcelas
    });
    if (!atualizado) return;
  } else {
    const id = parcelas > 1
      ? "parcela-" + Date.now() + "-" + Math.random().toString(36).slice(2)
      : null;
    const registros = criarParcelas(
      { nome, categoria, valor, vencimento, parcelas },
      mesAtual,
      id
    );
    for (const [chaveMes, conta] of registros) {
      if (chaveMes === mesAtual) {
        despesas.push(conta);
      } else {
        if (!dadosPorMes[chaveMes]) {
          dadosPorMes[chaveMes] = { salario: "", vt: "", despesas: [] };
        }
        dadosPorMes[chaveMes].despesas.push(conta);
      }
    }
    salvarDados();
  }

  fecharFormulario();
  renderizarDespesas();
});

// SALVAR SALÁRIO AUTOMATICAMENTE

salario.addEventListener("input", () => {
  atualizarResumo();
  salvarDados();
});

// O valor informado é salvo somente no mês selecionado.
vt.addEventListener("input", salvarDados);

// TROCAR DE MÊS
// O MÊS ANTERIOR É SALVO ANTES DE CARREGAR O NOVO

mes.addEventListener("change", () => {
  salvarDados();
  carregarMes();
});

// INICIALIZAR O APLICATIVO

carregarDados();

const agora = new Date();

const mesInicial = `${agora.getFullYear()}-${String(
  agora.getMonth() + 1
).padStart(2, "0")}`;

mes.value = mesInicial;

carregarMes();

// SERVICE WORKER

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registro = await navigator.serviceWorker.register(
        "./service-worker.js",
        { updateViaCache: "none" }
      );

      await registro.update();

      console.log("Service Worker atualizado!");
    } catch (erro) {
      console.error("Erro no Service Worker:", erro);
    }
  });
}
