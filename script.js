
const dinheiro = valor =>
  (Number(valor) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

// ELEMENTOS DO APLICATIVO

const mes = document.getElementById("mes");
const salario = document.getElementById("salario");
const vt = document.getElementById("vt");
const totalDespesas = document.getElementById("totalDespesas");
const saldo = document.getElementById("saldo");
const formulario = document.getElementById("formDespesa");
const lista = document.getElementById("listaDespesas");

const CHAVE = "meu-dinheiro-dados-v1";

let despesas = [];
let dadosPorMes = {};
let mesAtual = "";

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

  formulario.reset();
  formulario.hidden = true;

  renderizarDespesas();
}

// RECALCULAR RESUMO

function atualizarResumo() {
  const total = despesas.reduce(
    (soma, conta) => soma + (Number(conta.valor) || 0),
    0
  );

  totalDespesas.textContent = dinheiro(total);

  saldo.textContent = dinheiro(
    (Number(salario.value) || 0) - total
  );
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

    const nome = document.createElement("strong");
    nome.textContent = conta.nome;

    const info = document.createElement("p");

    info.style.cssText =
      "margin:6px 0 0;color:#788078;font-size:12px;";

    info.textContent = `${conta.categoria} · ${
      conta.vencimento
        ? new Date(
            conta.vencimento + "T12:00:00"
          ).toLocaleDateString("pt-BR")
        : "Sem vencimento"
    }`;

    const valor = document.createElement("strong");
    valor.textContent = dinheiro(conta.valor);

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
      despesas.splice(indice, 1);

      salvarDados();
      renderizarDespesas();
    });

    detalhes.append(nome, info);
    item.append(detalhes, valor, remover);
    lista.append(item);
  });

  atualizarResumo();
}

// ABRIR FORMULÁRIO DE DESPESA

document.getElementById("novaDespesa")
  .addEventListener("click", () => {
    formulario.hidden = false;
    document.getElementById("nomeDespesa").focus();
  });

// CANCELAR NOVA DESPESA

document.getElementById("cancelar")
  .addEventListener("click", () => {
    formulario.reset();
    formulario.hidden = true;
  });

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

  despesas.push({
    nome,
    categoria,
    valor,
    vencimento
  });

  salvarDados();

  formulario.reset();
  formulario.hidden = true;

  renderizarDespesas();
});

// SALVAR SALÁRIO AUTOMATICAMENTE

salario.addEventListener("input", () => {
  atualizarResumo();
  salvarDados();
});

// SALVAR VALE-TRANSPORTE AUTOMATICAMENTE

vt.addEventListener("input", () => {
  salvarDados();
});

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
