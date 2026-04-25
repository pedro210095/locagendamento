// ==========================================
// VARIÁVEIS GLOBAIS E GRÁFICOS
// ==========================================
let lembretesLocais = [];
let agendamentosRef = null;
let perfilRef = null; 
let usuarioLogadoUid = null;
let comissaoCorretor = 0; 
let configuracaoCorretor = { horaInicio: '08:00', horaFim: '18:00', duracao: '30', dias: [1,2,3,4,5,6] }; 

// Variáveis para controlo de navegação no calendário
let mesAtualCalendario = new Date().getMonth();
let anoAtualCalendario = new Date().getFullYear();

let chartChavesInstancia = null; 
let chartAcompanhamentoInstancia = null;
let chartBairrosInstancia = null;

let alertasDisparados = JSON.parse(localStorage.getItem('locagenda_alertas')) || []; 
let limiteLista = 20; 
let diaSelecionadoCalendario = null;
let filtroStatusAtual = 'todos'; 
let filtroChaveAtual = 'todas';

let fp, fpDashInicio, fpDashFim, fpExportInicio, fpExportFim; 

// ==========================================
// TEMA E COMISSÃO
// ==========================================
function toggleDarkMode() {
    const body = document.body;
    body.classList.toggle('dark-theme');
    const isDark = body.classList.contains('dark-theme');
    localStorage.setItem('locagenda_theme', isDark ? 'dark' : 'light');
    
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');
    if (icon && text) {
        if (isDark) { icon.classList.replace('fa-moon', 'fa-sun'); text.innerText = "Modo Claro"; }
        else { icon.classList.replace('fa-sun', 'fa-moon'); text.innerText = "Modo Escuro"; }
    }
    renderDashboard(); 
}
window.toggleDarkMode = toggleDarkMode;

window.salvarComissao = function() {
    const valInput = document.getElementById('input-comissao').value;
    const val = parseFloat(valInput) || 0;
    if (perfilRef) {
        window.dbSet(perfilRef, { 
            comissao: val,
            configAgenda: configuracaoCorretor 
        })
        .then(() => { alert("Comissão salva com sucesso!"); renderDashboard(); })
        .catch((e) => alert("Erro ao salvar: " + e.message));
    } else {
        alert("Aguarde a conexão com o servidor para salvar.");
    }
};

// ==========================================
// CONFIGURAÇÕES DA AGENDA & LINK PÚBLICO
// ==========================================
window.salvarConfiguracoes = function(evento) {
    evento.preventDefault();
    
    const checkboxes = document.querySelectorAll('input[name="config-dia"]:checked');
    const diasSelecionados = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    configuracaoCorretor = {
        horaInicio: document.getElementById('config-hora-inicio').value,
        horaFim: document.getElementById('config-hora-fim').value,
        duracao: document.getElementById('config-duracao').value,
        dias: diasSelecionados
    };

    if (perfilRef) {
        window.dbSet(perfilRef, {
            comissao: comissaoCorretor,
            configAgenda: configuracaoCorretor
        }).then(() => {
            alert("Configurações da agenda salvas com sucesso!");
        }).catch((e) => alert("Erro ao salvar: " + e.message));
    } else {
        alert("Aguarde a conexão com o servidor para salvar.");
    }
};

window.copiarLinkPublico = function() {
    const campoLink = document.getElementById("config-link-publico");
    campoLink.select();
    campoLink.setSelectionRange(0, 99999); 
    
    navigator.clipboard.writeText(campoLink.value).then(() => {
        alert("Link copiado com sucesso! Agora é só partilhar com os seus clientes.");
    }).catch(err => {
        console.error('Falha ao copiar o link: ', err);
        alert("Não foi possível copiar o link. Por favor, copie manualmente.");
    });
};

// ==========================================
// UTILITÁRIOS
// ==========================================
async function buscarCEP(cep) {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) return;
    try {
        const response = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
        const data = await response.json();
        if (!data.erro) {
            document.getElementById('form-rua').value = data.logradouro || '';
            document.getElementById('form-bairro').value = data.bairro || '';
            document.getElementById('form-cidade').value = data.localidade || '';
            document.getElementById('form-numero').focus();
        } else {
            alert("O CEP digitado não foi encontrado."); 
        }
    } catch (e) { console.error(e); }
}
window.buscarCEP = buscarCEP;

function obterEnderecoFormatado(item) {
    let str = "";
    if (item.rua) str += item.rua;
    if (item.numero) str += (str ? ", " : "") + item.numero;
    if (item.complemento) str += (str ? " - " : "") + item.complemento;
    if (item.bairro) str += (str ? " - " : "") + item.bairro;
    if (item.cidade) str += (str ? ", " : "") + item.cidade;
    return str || "Endereço não informado";
}

function formatarMoeda(valor) { 
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0); 
}

// ==========================================
// MENSAGENS WHATSAPP (APENAS WEB)
// ==========================================
function enviarWhatsApp(id) {
    const item = lembretesLocais.find(l => l.id === id);
    if (!item) return;
    
    const dataFormatada = new Date(item.horario).toLocaleDateString('pt-PT');
    const horaFormatada = new Date(item.horario).toLocaleTimeString('pt-PT', {hour: '2-digit', minute:'2-digit'});
    const endereco = obterEnderecoFormatado(item);

    const mensagem = `*LOCAGENDA - VISITA* 🏠\n\n` +
           `👤 *Cliente:* ${item.nome.toUpperCase()}\n` +
           `📅 *Data:* ${dataFormatada} | ⏰ ${horaFormatada}\n` +
           `📍 *Endereço:* ${endereco}\n` +
           `🔑 *Chave:* ${item.chave}\n` +
           `📝 *Notas:* ${item.texto || 'Nenhuma'}\n\n` +
           `📍 *Navegar:*\n` +
           `🗺️ Google Maps: https://maps.google.com/?q=${encodeURIComponent(endereco)}\n` +
           `🚗 Waze: https://waze.com/ul?q=${encodeURIComponent(endereco)}`;

    window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`, 'wpp_locagenda');
}
window.enviarWhatsApp = enviarWhatsApp;

// ==========================================
// AUTENTICAÇÃO E INICIALIZAÇÃO
// ==========================================
window.audioCtx = null;
function iniciarAudioGlobal() {
    if (!window.audioCtx) window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
}
document.addEventListener('click', iniciarAudioGlobal);

function monitorarAutenticacao() {
    if (!window.onAuthStateChanged || !window.auth) { 
        setTimeout(monitorarAutenticacao, 500); 
        return; 
    }
    
    window.onAuthStateChanged(window.auth, (user) => {
        const loader = document.getElementById('loading-global');
        if(loader) loader.style.display = 'none';

        if (user) {
            usuarioLogadoUid = user.uid;
            
            // Gerar Link Público e preencher no ecrã de configurações
            let urlBase = window.location.href.split('index.html')[0];
            if(!urlBase.endsWith('/')) urlBase += '/';
            document.getElementById('config-link-publico').value = `${urlBase}agendar.html?id=${user.uid}`;

            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container-main').style.display = 'flex';
            
            agendamentosRef = window.dbRef(window.db, `usuarios/${user.uid}/agendamentos`);
            window.dbOnValue(agendamentosRef, (snap) => {
                lembretesLocais = snap.val() ? Object.values(snap.val()) : [];
                renderDashboard(); 
                renderLista(); 
                renderCalendario();
                if(diaSelecionadoCalendario) mostrarVisitasDoDia(diaSelecionadoCalendario);
            });

            perfilRef = window.dbRef(window.db, `usuarios/${user.uid}/perfil`);
            window.dbOnValue(perfilRef, (snap) => {
                if(snap.exists()) {
                    const dados = snap.val();
                    
                    if (dados.comissao !== undefined) {
                        comissaoCorretor = dados.comissao;
                        const inputCom = document.getElementById('input-comissao');
                        if(inputCom) inputCom.value = comissaoCorretor;
                    }
                    
                    if (dados.configAgenda) {
                        configuracaoCorretor = dados.configAgenda;
                        document.getElementById('config-hora-inicio').value = configuracaoCorretor.horaInicio || '08:00';
                        document.getElementById('config-hora-fim').value = configuracaoCorretor.horaFim || '18:00';
                        document.getElementById('config-duracao').value = configuracaoCorretor.duracao || '30';
                        
                        const checkboxes = document.querySelectorAll('input[name="config-dia"]');
                        checkboxes.forEach(cb => {
                            cb.checked = configuracaoCorretor.dias.includes(parseInt(cb.value));
                        });
                    }

                    renderDashboard(); 
                }
            });
        } else {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('app-container-main').style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('locagenda_theme') === 'dark') {
        document.body.classList.add('dark-theme');
        const icon = document.getElementById('theme-icon');
        const text = document.getElementById('theme-text');
        if (icon && text) { icon.classList.replace('fa-moon', 'fa-sun'); text.innerText = "Modo Claro"; }
    }
    
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.log(e));

    try {
        fp = flatpickr("#form-datahora", { enableTime: true, dateFormat: "Y-m-d\\TH:i", altInput: true, altFormat: "d/m/Y \\à\\s H:i", time_24hr: true, locale: "pt" });
        const dashCfg = { dateFormat: "Y-m-d", altInput: true, altFormat: "d/m/Y", locale: "pt", onChange: () => renderDashboard() };
        fpDashInicio = flatpickr("#dash-data-inicio", dashCfg);
        fpDashFim = flatpickr("#dash-data-fim", dashCfg);
        const expCfg = { dateFormat: "Y-m-d", altInput: true, altFormat: "d/m/Y", locale: "pt" };
        fpExportInicio = flatpickr("#export-data-inicio", expCfg);
        fpExportFim = flatpickr("#export-data-fim", expCfg);
    } catch(e) {
        console.error("Erro ao carregar o calendário:", e);
    }

    definirFiltroMesAtual(); 
    monitorarAutenticacao(); 
    
    // --- ADICIONAR AQUI O PEDIDO DE PERMISSÃO ---
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
    
    // Temporizador seguro para alertas (Substitui o WebWorker)
    setInterval(verificarAlertas, 5000);
});

// ==========================================
// LÓGICA DE DATAS E MENUS
// ==========================================
function definirFiltroMesAtual() {
    const hoje = new Date();
    let start, end;
    if (hoje.getDate() >= 26) { 
        start = new Date(hoje.getFullYear(), hoje.getMonth(), 26); 
        end = new Date(hoje.getFullYear(), hoje.getMonth()+1, 25); 
    } else { 
        start = new Date(hoje.getFullYear(), hoje.getMonth()-1, 26); 
        end = new Date(hoje.getFullYear(), hoje.getMonth(), 25); 
    }
    if(fpDashInicio) fpDashInicio.setDate(start);
    if(fpDashFim) fpDashFim.setDate(end);
}
window.limparFiltrosDashboard = function() { 
    definirFiltroMesAtual(); 
    renderDashboard(); 
};

function switchTab(tabNome) {
    document.querySelectorAll('.tab-section, .nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabNome}`).classList.add('active');
    const btn = document.getElementById(`btn-tab-${tabNome}`);
    if(btn) btn.classList.add('active');
    
    if(tabNome === 'dashboard') renderDashboard();
    if(tabNome === 'list') renderLista();
}

// ==========================================
// FORMULÁRIO DE AGENDAMENTOS
// ==========================================
function prepararNovoAgendamento(dataEspecifica = null) {
    document.getElementById('agendamento-form').reset();
    document.getElementById('form-id').value = '';
    document.getElementById('form-cep').value = '';
    document.getElementById('form-rua').value = '';
    document.getElementById('form-numero').value = '';
    document.getElementById('form-complemento').value = '';
    document.getElementById('form-bairro').value = '';
    document.getElementById('form-cidade').value = '';
    document.getElementById('form-title').innerText = 'Agendar Nova Visita';
    
    if (dataEspecifica) { fp.setDate(`${dataEspecifica}T08:00`); } 
    else { fp.clear(); }
    
    switchTab('form');
}
window.prepararNovoAgendamento = prepararNovoAgendamento;

function prepararEdicao(id) {
    const item = lembretesLocais.find(l => l.id === id);
    if (!item) return;
    
    document.getElementById('form-id').value = item.id;
    document.getElementById('form-referencia').value = item.nome;
    document.getElementById('form-cep').value = item.cep || '';
    document.getElementById('form-rua').value = item.rua || '';
    document.getElementById('form-numero').value = item.numero || '';
    document.getElementById('form-complemento').value = item.complemento || '';
    document.getElementById('form-bairro').value = item.bairro || '';
    document.getElementById('form-cidade').value = item.cidade || '';
    document.getElementById('form-tipo').value = item.tipo || 'Locação';
    document.getElementById('form-valor').value = item.valor || '';
    document.getElementById('form-detalhes').value = item.texto || '';
    fp.setDate(item.horario);
    document.getElementById('form-antecedencia').value = item.antecedencia || '0';
    
    const radioAcomp = document.querySelector(`input[name="form-acompanhamento"][value="${item.acompanhamento}"]`);
    if(radioAcomp) radioAcomp.checked = true;
    else document.querySelector(`input[name="form-acompanhamento"][value="Acompanhar"]`).checked = true;

    // Verificação robusta adaptada para o formato unificado de Local da Chave
    const radioChave = document.querySelector(`input[name="form-chave"][value="${item.chave}"]`);
    if (radioChave) {
        radioChave.checked = true;
    } else if (item.retiradaChave && document.querySelector(`input[name="form-chave"][value="${item.retiradaChave}"]`)) {
        // Fallback caso seja um agendamento antigo que estava separado
        document.querySelector(`input[name="form-chave"][value="${item.retiradaChave}"]`).checked = true;
    } else {
        document.querySelector(`input[name="form-chave"][value="Locabens"]`).checked = true;
    }
    
    document.getElementById('form-title').innerText = 'Editar Visita';
    switchTab('form');
}
window.prepararEdicao = prepararEdicao;

function salvarAgendamento(evento) {
    evento.preventDefault();
    iniciarAudioGlobal();
    
    const dataHoraValue = document.getElementById('form-datahora').value;
    if (!dataHoraValue) { alert("Selecione data e hora."); return; }
    
    const idEdicao = document.getElementById('form-id').value;
    const valAcomp = document.querySelector('input[name="form-acompanhamento"]:checked').value;
    const valChave = document.querySelector('input[name="form-chave"]:checked').value;

    const novoItem = {
        id: idEdicao ? parseInt(idEdicao) : Date.now(),
        nome: document.getElementById('form-referencia').value,
        cep: document.getElementById('form-cep').value,
        rua: document.getElementById('form-rua').value,
        numero: document.getElementById('form-numero').value,
        complemento: document.getElementById('form-complemento').value,
        bairro: document.getElementById('form-bairro').value,
        cidade: document.getElementById('form-cidade').value,
        tipo: document.getElementById('form-tipo').value,
        valor: parseFloat(document.getElementById('form-valor').value) || 0,
        texto: document.getElementById('form-detalhes').value,
        horario: dataHoraValue,
        antecedencia: parseInt(document.getElementById('form-antecedencia').value) || 0,
        acompanhamento: valAcomp,
        chave: valChave,
        retiradaChave: '', // Mantido em branco para não quebrar compatibilidade de exportações
        status: `${valAcomp} - Chave: ${valChave}`
    };
    
    let listaAtualizada = lembretesLocais.filter(i => i.id != novoItem.id);
    const itemAntigo = lembretesLocais.find(i => i.id == novoItem.id);
    if(itemAntigo && itemAntigo.resultado) novoItem.resultado = itemAntigo.resultado;
    
    listaAtualizada.push(novoItem);
    
    if (agendamentosRef) {
        window.dbSet(agendamentosRef, listaAtualizada);
    }
    switchTab('list');
}
window.salvarAgendamento = salvarAgendamento;

function marcarStatus(id, statusSelecionado) {
    let listaCopia = [...lembretesLocais];
    const index = listaCopia.findIndex(x => x.id === id);
    if (index !== -1) { 
        listaCopia[index].resultado = statusSelecionado; 
        if(agendamentosRef) window.dbSet(agendamentosRef, listaCopia); 
    }
}
window.marcarStatus = marcarStatus;

function removerLembrete(id) { 
    if(confirm('Tem certeza que deseja apagar esta visita?')) {
        const filtrada = lembretesLocais.filter(i => i.id !== id);
        if(agendamentosRef) window.dbSet(agendamentosRef, filtrada);
    }
}
window.removerLembrete = removerLembrete;

// ==========================================
// RENDERIZAÇÃO DA LISTA DE AGENDAMENTOS
// ==========================================
window.mudarFiltroStatus = function(btn, status) {
    document.querySelectorAll('#filtros-status .pill-btn').forEach(e => e.classList.remove('active'));
    btn.classList.add('active'); 
    filtroStatusAtual = status; 
    renderLista();
};

window.mudarFiltroChave = function(btn, chave) {
    document.querySelectorAll('#filtros-chave .pill-btn').forEach(e => e.classList.remove('active'));
    btn.classList.add('active'); 
    filtroChaveAtual = chave; 
    renderLista();
};

function renderLista() {
    const tbody = document.getElementById('tabela-corpo');
    if(!tbody) return;
    const buscaTexto = document.getElementById('busca-lista').value.toLowerCase();
    
    const filtrados = lembretesLocais.filter(item => {
        const validaStatus = filtroStatusAtual === 'todos' ? true : (filtroStatusAtual === 'pendente' ? !item.resultado : item.resultado === filtroStatusAtual);
        const validaChave = filtroChaveAtual === 'todas' ? true : item.chave === filtroChaveAtual;
        const validaBusca = item.nome.toLowerCase().includes(buscaTexto) || (item.rua && item.rua.toLowerCase().includes(buscaTexto));
        return validaStatus && validaChave && validaBusca;
    }).sort((a,b) => new Date(a.horario) - new Date(b.horario));

    tbody.innerHTML = '';
    
    filtrados.slice(0, limiteLista).forEach(item => {
        const tr = document.createElement('tr');
        if (item.resultado) tr.classList.add('is-finished');
        
        const dataFormatada = new Date(item.horario).toLocaleString('pt-PT');
        const badge = item.resultado ? `<span class="badge badge-${item.resultado === 'Efetivado' ? 'success' : 'danger'}">${item.resultado}</span>` : `<span class="badge badge-pending">Pendente</span>`;
        
        let acoes = `<div class="actions-group"><button class="btn-action btn-action-neutral" onclick="enviarWhatsApp(${item.id})" title="Enviar para WhatsApp"><i class="fa-brands fa-whatsapp" style="color: #25D366;"></i></button>`;
        
        if (!item.resultado) {
            acoes += `<button class="btn-action btn-action-success" onclick="marcarStatus(${item.id}, 'Efetivado')"><i class="fa-solid fa-check"></i></button>
                      <button class="btn-action btn-action-warning" onclick="marcarStatus(${item.id}, 'Frustrado')"><i class="fa-solid fa-xmark"></i></button>
                      <button class="btn-action btn-action-info" onclick="prepararEdicao(${item.id})"><i class="fa-solid fa-pen"></i></button>`;
        } else {
            acoes += `<button class="btn-action btn-action-neutral" onclick="marcarStatus(${item.id}, null)"><i class="fa-solid fa-rotate-left"></i></button>`;
        }
        acoes += `<button class="btn-action btn-action-danger" onclick="removerLembrete(${item.id})"><i class="fa-solid fa-trash"></i></button></div>`;

        const detalhesVisita = item.texto ? item.texto : 'Sem detalhes informados';
        tr.innerHTML = `<td><b>${item.nome}</b><br><small>${detalhesVisita}</small></td><td>${formatarMoeda(item.valor)}</td><td>${dataFormatada}</td><td>${item.status}</td><td>${badge}</td><td style="text-align:right;">${acoes}</td>`;
        
        tbody.appendChild(tr);
    });
}
window.renderLista = renderLista;

// ==========================================
// RENDERIZAÇÃO DO PAINEL DE CONTROLE (DASHBOARD BI)
// ==========================================
function renderDashboard() {
    let dadosDashboard = lembretesLocais || [];
    const dataInicioStr = document.getElementById('dash-data-inicio') ? document.getElementById('dash-data-inicio').value : null;
    const dataFimStr = document.getElementById('dash-data-fim') ? document.getElementById('dash-data-fim').value : null;
    const tempoAgora = new Date();
    
    // Próxima Visita
    const proximasVisitas = dadosDashboard.filter(item => item.horario && new Date(item.horario) >= tempoAgora && !item.resultado).sort((a, b) => new Date(a.horario) - new Date(b.horario));
    const cardProximaVisita = document.getElementById('proxima-visita-content');
    
    if (cardProximaVisita) {
        if (proximasVisitas.length > 0) {
            const prox = proximasVisitas[0];
            const endStr = obterEnderecoFormatado(prox);
            
            const diffMs = new Date(prox.horario) - tempoAgora;
            const hRestante = Math.floor(diffMs / 3600000);
            const mRestante = Math.floor((diffMs % 3600000) / 60000);
            
            cardProximaVisita.innerHTML = `
                <h3 style="font-size: 1.3rem; font-weight: bold; text-transform: uppercase;">${prox.nome}</h3>
                <p style="color: var(--text-main); font-size: 1rem; margin-top: 6px; opacity: 0.9;"><i class="fa-solid fa-location-dot" style="color: var(--danger); width: 16px;"></i> ${endStr}</p>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px;">
                    <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(59, 130, 246, 0.1); color: var(--text-main); padding: 8px 14px; border-radius: 8px; font-weight: bold; font-size: 0.9rem;">
                        <i class="fa-regular fa-calendar-check" style="color: var(--info);"></i> ${new Date(prox.horario).toLocaleString('pt-PT')}
                    </div>
                    <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(234, 179, 8, 0.1); color: var(--warning); border: 1px solid var(--warning); padding: 8px 14px; border-radius: 8px; font-weight: bold; font-size: 0.9rem;">
                        <i class="fa-solid fa-hourglass-half fa-spin"></i> Falta(m): ${hRestante}h ${mRestante}m
                    </div>
                </div>`;
        } else { 
            cardProximaVisita.innerHTML = `<p style="color: var(--text-muted); font-style: italic;">Nenhuma visita futura agendada.</p>`; 
        }
    }

    // Filtrar pelo Período Escolhido
    if (dataInicioStr || dataFimStr) {
        dadosDashboard = dadosDashboard.filter(item => {
            if(!item.horario) return false;
            const dataPura = item.horario.split('T')[0];
            return (!dataInicioStr || dataPura >= dataInicioStr) && (!dataFimStr || dataPura <= dataFimStr);
        });
    }

    // Cálculos de KPIs (Cartões)
    const arrayEfetivados = dadosDashboard.filter(v => v.resultado === 'Efetivado');
    const arrayFrustrados = dadosDashboard.filter(v => v.resultado === 'Frustrado');
    const arrayPendentes = dadosDashboard.filter(v => !v.resultado);
    
    const visitasAvaliadas = arrayEfetivados.length + arrayFrustrados.length;
    const taxaConversao = visitasAvaliadas > 0 ? Math.round((arrayEfetivados.length / visitasAvaliadas) * 100) : 0;

    const somaTotal = dadosDashboard.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const somaEfetivados = arrayEfetivados.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const somaPendentes = arrayPendentes.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const somaFrustrados = arrayFrustrados.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    
    const valorComissaoCalculado = somaEfetivados * (comissaoCorretor / 100);

    // Atualizar UI dos Cartões
    if(document.getElementById('count-total')) document.getElementById('count-total').innerText = dadosDashboard.length;
    if(document.getElementById('count-pendentes')) document.getElementById('count-pendentes').innerText = arrayPendentes.length;
    if(document.getElementById('count-efetivados')) document.getElementById('count-efetivados').innerText = arrayEfetivados.length;
    if(document.getElementById('count-frustrados')) document.getElementById('count-frustrados').innerText = arrayFrustrados.length;

    if(document.getElementById('valor-total')) document.getElementById('valor-total').innerText = formatarMoeda(somaTotal);
    if(document.getElementById('valor-pendentes')) document.getElementById('valor-pendentes').innerText = formatarMoeda(somaPendentes);
    if(document.getElementById('valor-efetivados')) document.getElementById('valor-efetivados').innerText = formatarMoeda(somaEfetivados);
    if(document.getElementById('valor-frustrados')) document.getElementById('valor-frustrados').innerText = formatarMoeda(somaFrustrados);

    if(document.getElementById('taxa-conversao')) document.getElementById('taxa-conversao').innerText = taxaConversao + '%';
    if(document.getElementById('valor-comissao')) document.getElementById('valor-comissao').innerText = formatarMoeda(valorComissaoCalculado);
    
    atualizarGraficosCorporativos(dadosDashboard);
}

function atualizarGraficosCorporativos(dadosGraficos) {
    const temaEscuroAtivo = document.body.classList.contains('dark-theme');
    const corTexto = temaEscuroAtivo ? '#f8fafc' : '#1e293b';
    const corGrelha = temaEscuroAtivo ? '#334155' : '#e2e8f0';

    let acompanhouSim = 0, acompanhouNao = 0;
    let chavesLocabens = 0, chavesRedentora = 0;
    let bairrosContagem = {};

    dadosGraficos.forEach(visita => { 
        
        // Lógica Exclusiva para Efetivados (Chaves e Acompanhamento)
        if (visita.resultado === 'Efetivado') {
            if(visita.acompanhamento === 'Acompanhar') acompanhouSim++; 
            else if(visita.acompanhamento === 'Não Acompanhar') acompanhouNao++; 
            
            if(visita.chave === 'Locabens') chavesLocabens++;
            else if (visita.chave === 'Redentora') chavesRedentora++;
        }
        
        // Lógica para todos (Bairros)
        let nomeBairro = visita.bairro ? visita.bairro.trim() : '';
        if(nomeBairro === '') nomeBairro = 'Não Informado';
        bairrosContagem[nomeBairro] = (bairrosContagem[nomeBairro] || 0) + 1;
    });

    let bairrosOrdenados = Object.keys(bairrosContagem).sort((a,b) => bairrosContagem[b] - bairrosContagem[a]).slice(0, 5);
    let valoresBairros = bairrosOrdenados.map(b => bairrosContagem[b]);

    // 1. Chaves (Rosca) - Apenas Efetivados COM VALORES NA LEGENDA
    const ctx1 = document.getElementById('chartChaves');
    if (ctx1) {
        if (chartChavesInstancia) chartChavesInstancia.destroy();
        chartChavesInstancia = new Chart(ctx1.getContext('2d'), { 
            type: 'doughnut', 
            data: { 
                labels: [`Locabens (${chavesLocabens})`, `Redentora (${chavesRedentora})`], 
                datasets: [{ data: [chavesLocabens, chavesRedentora], backgroundColor: ['#3b82f6', '#a855f7'], borderWidth: 0 }] 
            }, 
            options: { plugins: { legend: { labels: { color: corTexto } } }, maintainAspectRatio: false } 
        });
    }

    // 2. Acompanhamento (Rosca) - Apenas Efetivados COM VALORES NA LEGENDA
    const ctx2 = document.getElementById('chartAcompanhamento');
    if (ctx2) {
        if (chartAcompanhamentoInstancia) chartAcompanhamentoInstancia.destroy();
        chartAcompanhamentoInstancia = new Chart(ctx2.getContext('2d'), { 
            type: 'doughnut', 
            data: { 
                labels: [`Acompanhou (${acompanhouSim})`, `Foi Sozinho (${acompanhouNao})`], 
                datasets: [{ data: [acompanhouSim, acompanhouNao], backgroundColor: ['#3b82f6', '#f59e0b'], borderWidth: 0 }] 
            }, 
            options: { plugins: { legend: { labels: { color: corTexto } } }, maintainAspectRatio: false } 
        });
    }

    // 3. Bairros Mais Visitados (Barras Horizontais)
    const ctx4 = document.getElementById('chartBairros');
    if (ctx4) {
        if (chartBairrosInstancia) chartBairrosInstancia.destroy();
        chartBairrosInstancia = new Chart(ctx4.getContext('2d'), { 
            type: 'bar', 
            data: { 
                labels: bairrosOrdenados, 
                datasets: [{ label: 'Visitas no Bairro', data: valoresBairros, backgroundColor: '#14b8a6', borderRadius: 4 }] 
            }, 
            options: { 
                indexAxis: 'y', 
                plugins: { legend: { display: false } },
                scales: { x: { ticks: { color: corTexto, stepSize: 1 }, grid: { color: corGrelha } }, y: { ticks: { color: corTexto }, grid: { display: false } } },
                maintainAspectRatio: false 
            } 
        });
    }
}

// ==========================================
// ALERTAS DE TEMPO SEGUROS E NAVEGAÇÃO DO CALENDÁRIO
// ==========================================
function verificarAlertas() {
    const tempoMomento = new Date().getTime();

    lembretesLocais.forEach(visita => {
        // Ignora se a visita já foi finalizada (Efetivado/Frustrado) ou não tem horário
        if (visita.resultado || !visita.horario) return;

        const tempoVisita = new Date(visita.horario).getTime();
        const antecedenciaMinutos = parseInt(visita.antecedencia) || 0;
        const antecedenciaMs = antecedenciaMinutos * 60000;

        // --- 1. ALERTA DE AVISO PRÉVIO (Se houver antecedência) ---
        if (antecedenciaMinutos > 0) {
            const chaveAviso = `aviso_${visita.id}_${visita.horario}`;
            const momentoAviso = tempoVisita - antecedenciaMs;

            // Dispara se passou do momento do aviso, mas ainda NÃO chegou na hora exata
            if (tempoMomento >= momentoAviso && tempoMomento < tempoVisita && !alertasDisparados.includes(chaveAviso)) {
                mostrarNotificacao(
                    `⏳ Lembrete: Faltam ${antecedenciaMinutos} minutos!`,
                    `A visita de ${visita.nome.toUpperCase()} acontecerá em breve.`,
                    chaveAviso
                );
            }
        }

        // --- 2. ALERTA DA HORA EXATA ---
        const chaveHora = `hora_${visita.id}_${visita.horario}`;

        // Dispara se chegou na hora exata da visita (com margem de 1h para não disparar alertas muito antigos)
        if (tempoMomento >= tempoVisita && (tempoMomento - tempoVisita) <= 3600000 && !alertasDisparados.includes(chaveHora)) {
            mostrarNotificacao(
                `⏰ Está na hora da visita!`,
                `Cliente: ${visita.nome.toUpperCase()}. Tenha um excelente atendimento!`,
                chaveHora
            );
        }
    });
}

// Função auxiliar para gerir as notificações na tela e no sistema operativo
function mostrarNotificacao(titulo, mensagem, chaveSalvar) {
    // 1. Notificação dentro do site (Modal HTML)
    const textoModal = document.getElementById('alerta-texto');
    if (textoModal) {
        textoModal.innerHTML = `<strong style="color: var(--text-main); font-size: 1.1rem; display: block; margin-bottom: 4px;">${titulo}</strong>${mensagem}`;
        document.getElementById('alerta-modal').classList.add('show');
    }

    // 2. Notificação Nativa (Fora da tela do navegador)
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("LocAgenda", {
            body: `${titulo}\n${mensagem}`,
            requireInteraction: true,
            vibrate: [200, 100, 200]
        });
    }

    // 3. Registar o alerta para não repetir
    alertasDisparados.push(chaveSalvar);
    localStorage.setItem('locagenda_alertas', JSON.stringify(alertasDisparados));
}

window.fecharAlerta = function() { 
    document.getElementById('alerta-modal').classList.remove('show'); 
};
window.fecharAlerta = function() { 
    document.getElementById('alerta-modal').classList.remove('show'); 
};

// Funções para mudar o mês do calendário
window.mudarMesCalendario = function(direcao) {
    mesAtualCalendario += direcao;
    if (mesAtualCalendario < 0) {
        mesAtualCalendario = 11;
        anoAtualCalendario--;
    } else if (mesAtualCalendario > 11) {
        mesAtualCalendario = 0;
        anoAtualCalendario++;
    }
    renderCalendario();
};

function renderCalendario() {
    const gridCalendario = document.getElementById('calendar-grid');
    if (!gridCalendario) return;
    gridCalendario.innerHTML = '';
    
    const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const mesDisplay = document.getElementById('mes-ano-display');
    if(mesDisplay) {
        mesDisplay.innerText = `${mesesNomes[mesAtualCalendario]} ${anoAtualCalendario}`;
    }
    
    const primeiroDia = new Date(anoAtualCalendario, mesAtualCalendario, 1);
    const ultimoDia = new Date(anoAtualCalendario, mesAtualCalendario + 1, 0);
    
    const diaSemanaInicio = primeiroDia.getDay();
    for(let i = 0; i < diaSemanaInicio; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'calendar-day empty';
        gridCalendario.appendChild(emptyDiv);
    }
    
    let dataAtual = new Date(primeiroDia);
    
    while (dataAtual <= ultimoDia) {
        const ano = dataAtual.getFullYear();
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        const dia = String(dataAtual.getDate()).padStart(2, '0');
        const dStringFormatada = `${ano}-${mes}-${dia}`;
        
        const visitasDesseDia = lembretesLocais.filter(v => v.horario && v.horario.startsWith(dStringFormatada));
        
        const celulaDia = document.createElement('div');
        celulaDia.className = `calendar-day ${dStringFormatada === diaSelecionadoCalendario ? 'selected' : ''}`;
        
        const hojeRef = new Date();
        const hojeString = `${hojeRef.getFullYear()}-${String(hojeRef.getMonth() + 1).padStart(2, '0')}-${String(hojeRef.getDate()).padStart(2, '0')}`;
        if (dStringFormatada === hojeString) {
            celulaDia.classList.add('today');
        }
        
        let bolinhasHtml = '';
        if(visitasDesseDia.length > 0) {
            bolinhasHtml = '<div class="calendar-dots">';
            visitasDesseDia.slice(0,3).forEach(v => { 
                let classeCor = '';
                if(v.resultado === 'Efetivado') classeCor = 'dot-success';
                else if (v.resultado === 'Frustrado') classeCor = 'dot-danger';
                bolinhasHtml += `<div class="dot ${classeCor}"></div>`; 
            });
            bolinhasHtml += '</div>';
        }
        
        celulaDia.innerHTML = `<span class="calendar-date-num">${dataAtual.getDate()}</span>${bolinhasHtml}`;
        
        const curString = dStringFormatada;
        celulaDia.onclick = () => { 
            diaSelecionadoCalendario = curString; 
            renderCalendario(); 
            mostrarVisitasDoDia(curString); 
        };
        
        gridCalendario.appendChild(celulaDia);
        dataAtual.setDate(dataAtual.getDate() + 1);
    }
}

function mostrarVisitasDoDia(dString) {
    const tabelaDiaria = document.getElementById('daily-agenda-body');
    const containerDiario = document.getElementById('daily-agenda-container');
    if(!containerDiario) return;
    
    containerDiario.style.display = 'block';
    
    const visitasFiltradas = lembretesLocais.filter(i => i.horario && i.horario.startsWith(dString)).sort((a,b) => new Date(a.horario) - new Date(b.horario));
    tabelaDiaria.innerHTML = visitasFiltradas.length === 0 ? '<tr><td colspan="5" style="text-align:center;">Nenhuma visita para este dia.</td></tr>' : '';
    
    visitasFiltradas.forEach(item => {
        const horaTratada = new Date(item.horario).toLocaleTimeString('pt-PT', {hour: '2-digit', minute:'2-digit'});
        
        let botoesAcao = `<div class="actions-group"><button class="btn-action btn-action-neutral" onclick="enviarWhatsApp(${item.id})" title="Enviar para WhatsApp"><i class="fa-brands fa-whatsapp" style="color: #25D366;"></i></button>`;
        
        if (!item.resultado) {
            botoesAcao += `<button class="btn-action btn-action-success" onclick="marcarStatus(${item.id}, 'Efetivado')"><i class="fa-solid fa-check"></i></button>
                           <button class="btn-action btn-action-warning" onclick="marcarStatus(${item.id}, 'Frustrado')"><i class="fa-solid fa-xmark"></i></button>
                           <button class="btn-action btn-action-info" onclick="prepararEdicao(${item.id})"><i class="fa-solid fa-pen"></i></button>`;
        } else {
            botoesAcao += `<button class="btn-action btn-action-neutral" onclick="marcarStatus(${item.id}, null)"><i class="fa-solid fa-rotate-left"></i></button>`;
        }
        botoesAcao += `<button class="btn-action btn-action-danger" onclick="removerLembrete(${item.id})"><i class="fa-solid fa-trash"></i></button></div>`;
        
        const enderecoFormatado = obterEnderecoFormatado(item);
        const cracha = item.resultado === 'Efetivado' ? `<span class="badge badge-success">Efetivado</span>` : (item.resultado === 'Frustrado' ? `<span class="badge badge-danger">Frustrado</span>` : `<span class="badge badge-pending">Pendente</span>`);
        
        const linha = document.createElement('tr');
        linha.innerHTML = `<td><b>${item.nome}</b></td><td><small>${enderecoFormatado}</small></td><td>${horaTratada}</td><td>${cracha}</td><td style="text-align:right;">${botoesAcao}</td>`;
        tabelaDiaria.appendChild(linha);
    });
}

// ==========================================
// EXPORTAÇÃO PDF & CSV (RELATÓRIOS AVANÇADOS)
// ==========================================
window.exportarAgendamentos = function() {
    const dataHj = new Date();
    let inicioCiclo, fimCiclo;
    
    if (dataHj.getDate() >= 26) { 
        inicioCiclo = new Date(dataHj.getFullYear(), dataHj.getMonth(), 26); 
        fimCiclo = new Date(dataHj.getFullYear(), dataHj.getMonth()+1, 25); 
    } else { 
        inicioCiclo = new Date(dataHj.getFullYear(), dataHj.getMonth()-1, 26); 
        fimCiclo = new Date(dataHj.getFullYear(), dataHj.getMonth(), 25); 
    }
    
    if(fpExportInicio) fpExportInicio.setDate(inicioCiclo); 
    if(fpExportFim) fpExportFim.setDate(fimCiclo);
    
    document.getElementById('exportar-modal').classList.add('show');
};

window.fecharModalExportar = function() { 
    document.getElementById('exportar-modal').classList.remove('show'); 
};

function aplicarFiltroParaExportacao() {
    const strInicio = document.getElementById('export-data-inicio').value;
    const strFim = document.getElementById('export-data-fim').value;
    
    return lembretesLocais.filter(item => {
        if (!item.horario) return false;
        const dataComparacao = item.horario.split('T')[0];
        return (!strInicio || dataComparacao >= strInicio) && (!strFim || dataComparacao <= strFim);
    }).sort((a,b) => new Date(a.horario) - new Date(b.horario));
}

window.gerarCSV = function() {
    const listaDados = aplicarFiltroParaExportacao();
    if (listaDados.length === 0) { alert("Nenhuma visita encontrada."); return; }
    let conteudoArquivo = "\uFEFF"; 
    conteudoArquivo += "Data/Hora;Cliente;CEP;Rua;Numero;Complemento;Bairro;Cidade;Valor(R$);Acompanhamento;Chave;Status;Observacoes\n";
    listaDados.forEach(visita => {
        const dtStr = new Date(visita.horario).toLocaleString('pt-PT');
        conteudoArquivo += `${dtStr};"${visita.nome}";"${visita.cep||''}";"${visita.rua||''}";"${visita.numero||''}";"${visita.complemento||''}";"${visita.bairro||''}";"${visita.cidade||''}";${visita.valor||0};"${visita.acompanhamento}";"${visita.chave}";"${visita.resultado||'Pendente'}";"${(visita.texto||'').replace(/\n/g, ' ')}"\n`;
    });
    const blobCSV = new Blob([conteudoArquivo], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blobCSV));
    link.setAttribute("download", "LocAgenda_Relatorio.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.gerarPDF = function() {
    const listaDados = aplicarFiltroParaExportacao();
    if (listaDados.length === 0) { alert("Nenhuma visita encontrada para este período."); return; }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape'); 
    
    // NOME DA CONTA GOOGLE
    const nomeCorretor = (window.auth && window.auth.currentUser) ? window.auth.currentUser.displayName : "Corretor(a)";

    // ==========================================
    // CABEÇALHO PADRONIZADO
    // ==========================================
    doc.setFontSize(22);
    doc.setTextColor(22, 163, 74); 
    doc.text("LOCAGENDA", 14, 18);
    
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text(`Corretor: ${nomeCorretor}`, 14, 26);

    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    const tipoPDF = document.getElementById('export-tipo-pdf').value;
    let tituloRelatorio = tipoPDF === 'lista' ? "Relatório: Lista Detalhada de Visitas" : "Relatório: Resumo Financeiro e Desempenho";
    doc.text(tituloRelatorio, 14, 35);

    const dataInicioStr = document.getElementById('export-data-inicio').value;
    const dataFimStr = document.getElementById('export-data-fim').value;
    const formataDataBR = (d) => d ? d.split('-').reverse().join('/') : 'Início';
    const textoPeriodo = `Período: ${formataDataBR(dataInicioStr)} até ${formataDataBR(dataFimStr)}`;
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(textoPeriodo, 14, 43);

    const dataEmissao = new Date().toLocaleString('pt-PT');
    doc.setFontSize(9);
    doc.text(`Emitido em: ${dataEmissao}`, 280, 18, { align: 'right' });

    // ==========================================
    // BLOCO 1: LISTA DETALHADA
    // ==========================================
    if (tipoPDF === 'lista') {
        const colunas = ["Data/Hora", "Cliente", "Endereço", "Acompanhamento", "Chave", "Status"];
        const linhas = listaDados.map(i => [
            new Date(i.horario).toLocaleString('pt-PT', {dateStyle: 'short', timeStyle: 'short'}), 
            i.nome, 
            obterEnderecoFormatado(i), 
            i.acompanhamento, 
            i.chave, 
            i.resultado || 'Pendente'
        ]);
        
        doc.autoTable({ 
            startY: 50, 
            head: [colunas], 
            body: linhas, 
            headStyles: { fillColor: [22, 163, 74] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 5) {
                    if (data.cell.raw === 'Efetivado') data.cell.styles.textColor = [22, 163, 74];
                    else if (data.cell.raw === 'Frustrado') data.cell.styles.textColor = [220, 38, 38];
                }
            }
        });

        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.text(`Total de Agendamentos no Período: ${listaDados.length}`, 14, finalY);

    } 
    // ==========================================
    // BLOCO 2: RESUMO FINANCEIRO E CONVERSÃO
    // ==========================================
    else {
        // --- CÁLCULOS ---
        const totalVisitas = listaDados.length;
        const ef = listaDados.filter(v => v.resultado === 'Efetivado');
        const fr = listaDados.filter(v => v.resultado === 'Frustrado');
        const pe = listaDados.filter(v => !v.resultado);

        const vEf = ef.reduce((a, b) => a + (b.valor || 0), 0);
        const vFr = fr.reduce((a, b) => a + (b.valor || 0), 0); 
        const comissao = vEf * (comissaoCorretor / 100);
        const taxaConversao = totalVisitas > 0 ? ((ef.length / totalVisitas) * 100).toFixed(1) : 0;

        const locabens = listaDados.filter(v => v.chave === 'Locabens').length;
        const redentora = listaDados.filter(v => v.chave === 'Redentora').length;
        const acomp = listaDados.filter(v => v.acompanhamento === 'Acompanhar').length;
        const nAcomp = listaDados.filter(v => v.acompanhamento === 'Não Acompanhar').length;

        // --- TABELA 1: FUNIL DE CONVERSÃO ---
        doc.autoTable({
             startY: 50,
             head: [["1. Indicadores de Conversão", "Quantidade / %"]],
             body: [
                 ["Total de Agendamentos", totalVisitas],
                 ["Visitas Efetivadas (Sucesso)", ef.length],
                 ["Visitas Frustradas (Canceladas/Falta)", fr.length],
                 ["Visitas Pendentes", pe.length],
                 ["Taxa de Conversão Geral", `${taxaConversao}%`]
             ],
             headStyles: { fillColor: [30, 41, 59] }, // Azul Escuro
             columnStyles: { 1: { halign: 'center', fontStyle: 'bold' } }
        });

       // --- CÁLCULOS SEPARADOS (Substitua a Tabela 2 por este bloco) ---
        const efVendas = ef.filter(v => v.tipo === 'Venda');
        const efLocacao = ef.filter(v => v.tipo !== 'Venda'); // Se não tiver tipo, assume locação por padrão

        const vgvVendas = efVendas.reduce((a, b) => a + (b.valor || 0), 0);
        const vglLocacao = efLocacao.reduce((a, b) => a + (b.valor || 0), 0);
        
        // A comissão precisa ser flexível. Como a % de venda e locação costumam ser diferentes, 
        // vamos mostrar o volume e uma estimativa baseada na % que o corretor configurou.
        const comissaoEstimada = (vgvVendas + vglLocacao) * (comissaoCorretor / 100);

        // --- TABELA 2: DESEMPENHO FINANCEIRO ---
        let startY2 = doc.lastAutoTable.finalY + 10;
        doc.autoTable({
             startY: startY2,
             head: [["2. Desempenho Financeiro", "Valor Movimentado"]],
             body: [
                 ["VGL Efetivado (Locação)", formatarMoeda(vglLocacao)],
                 ["VGV Efetivado (Vendas)", formatarMoeda(vgvVendas)],
                 ["VGV/VGL de Visitas Frustradas (Perda Estimada)", formatarMoeda(vFr)], 
                 [`Comissão Estimada Global (${comissaoCorretor}%)`, formatarMoeda(comissaoEstimada)]
             ],
             headStyles: { fillColor: [22, 163, 74] },
             columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
             didParseCell: function(data) {
                if (data.section === 'body' && data.row.index === 2) { // Destaca a perda em vermelho
                    data.cell.styles.textColor = [220, 38, 38]; 
                }
             }
        });

        // --- TABELA 3: DETALHES OPERACIONAIS ---
        let startY3 = doc.lastAutoTable.finalY + 10;
        doc.autoTable({
             startY: startY3,
             head: [["3. Detalhamento Operacional", "Quantidade"]],
             body: [
                 ["Retirada de Chaves: Locabens", locabens],
                 ["Retirada de Chaves: Redentora", redentora],
                 ["Visitas Acompanhadas pelo Corretor", acomp],
                 ["Clientes foram Sozinhos ao Imóvel", nAcomp]
             ],
             headStyles: { fillColor: [71, 85, 105] }, // Cinza Chumbo
             columnStyles: { 1: { halign: 'center', fontStyle: 'bold' } }
        });
    }
    
    // ==========================================
    // RODAPÉ COM PAGINAÇÃO
    // ==========================================
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount}`, 280, 205, { align: 'right' });
    }

    doc.save(`LocAgenda_Relatorio_${new Date().getTime()}.pdf`);
};
function fazerLogout() { window.logout(); }
window.fazerLogout = fazerLogout;