// ==========================================
// VARIÁVEIS GLOBAIS
// ==========================================
let lembretesLocais = [];
let agendamentosRef = null;
let chartConversaoInstancia = null; 
let chartChavesInstancia = null; 

// Puxa a memória permanente do navegador para não repetir alertas após F5
let alertasDisparados = JSON.parse(localStorage.getItem('locagenda_alertas')) || []; 

let limiteLista = 20; 
let diaSelecionadoCalendario = null;
let filtroStatusAtual = 'todos'; 
let workerRelogio = null;

// ==========================================
// TEMA ESCURO (DARK MODE)
// ==========================================
function toggleDarkMode() {
    const body = document.body;
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');

    body.classList.toggle('dark-theme');

    const isDark = body.classList.contains('dark-theme');
    
    // Guarda a preferência no navegador
    localStorage.setItem('locagenda_theme', isDark ? 'dark' : 'light');

    // Atualiza o ícone e o texto do botão, se eles existirem no HTML
    if (icon && text) {
        if (isDark) {
            icon.classList.replace('fa-moon', 'fa-sun');
            text.innerText = "Modo Claro";
        } else {
            icon.classList.replace('fa-sun', 'fa-moon');
            text.innerText = "Modo Escuro";
        }
    }
}
// Torna a função acessível no HTML
window.toggleDarkMode = toggleDarkMode;

// ==========================================
// SETUP DO ÁUDIO GLOBAL
// ==========================================
window.audioCtx = null;
function iniciarAudioGlobal() {
    if (!window.audioCtx) {
        window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (window.audioCtx.state === 'suspended') {
        window.audioCtx.resume();
    }
}
document.addEventListener('click', iniciarAudioGlobal);

// ==========================================
// AUTENTICAÇÃO E FIREBASE
// ==========================================
function monitorarAutenticacao() {
    if (!window.onAuthStateChanged) { setTimeout(monitorarAutenticacao, 500); return; }
    
    window.onAuthStateChanged(window.auth, (user) => {
        const loadingGlobal = document.getElementById('loading-global');
        if (loadingGlobal) loadingGlobal.style.display = 'none';

        if (user) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container-main').style.display = 'flex';
            
            const tbody = document.getElementById('tabela-corpo');
            if(tbody) {
                tbody.innerHTML = `<tr><td colspan="6"><div class="spinner"></div><p style="text-align:center;">A carregar...</p></td></tr>`;
            }

            agendamentosRef = window.dbRef(window.db, `usuarios/${user.uid}/agendamentos`);
            
            window.dbOnValue(agendamentosRef, (snapshot) => {
                const data = snapshot.val();
                lembretesLocais = data ? Object.values(data) : [];
                renderDashboard();
                renderLista();
                renderCalendario();
                if(diaSelecionadoCalendario) mostrarVisitasDoDia(diaSelecionadoCalendario);
            });
        } else {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('app-container-main').style.display = 'none';
        }
    });
}

window.fazerLogout = () => { if(confirm("Deseja sair da conta?")) window.logout(); };

function getLembretes() { return lembretesLocais || []; }

function saveLembretes(lembretes) {
    if (agendamentosRef) window.dbSet(agendamentosRef, lembretes);
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Verifica o Tema guardado
    const savedTheme = localStorage.getItem('locagenda_theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        const icon = document.getElementById('theme-icon');
        const text = document.getElementById('theme-text');
        if (icon && text) {
            icon.classList.replace('fa-moon', 'fa-sun');
            text.innerText = "Modo Claro";
        }
    }

    // 2. Inicia o Service Worker para notificações em background
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW Erro:', err));
    }
    
    // 3. Arranca com as restantes funções do sistema
    definirFiltroMesAtual();
    monitorarAutenticacao(); 
    iniciarMonitorAlertas();
});

// ==========================================
// FUNÇÕES UTILITÁRIAS
// ==========================================
function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function formatarDataParaInput(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function calcularTempoRestante(dataHoraVisita) {
    const agora = new Date();
    const dataVisita = new Date(dataHoraVisita);
    const diffMs = dataVisita - agora;
    if (diffMs <= 0) return "Em curso ou finalizada";
    
    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let partes = [];
    if (dias > 0) partes.push(`${dias}d`);
    if (horas > 0) partes.push(`${horas}h`);
    if (minutos > 0 || partes.length === 0) partes.push(`${minutos}min`);

    return `Falta(m): ${partes.join(' ')}`;
}

function definirFiltroMesAtual() {
    const hoje = new Date();
    let dataInicio, dataFim;
    if (hoje.getDate() >= 26) {
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 26);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 25);
    } else {
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 26);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), 25);
    }
    document.getElementById('dash-data-inicio').value = formatarDataParaInput(dataInicio);
    document.getElementById('dash-data-fim').value = formatarDataParaInput(dataFim);
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    
    const btnTab = document.getElementById(`btn-tab-${tabId}`);
    if(btnTab) btnTab.classList.add('active');
    
    if(tabId === 'dashboard') renderDashboard();
    if(tabId === 'list') renderLista();
    if(tabId === 'calendar') renderCalendario(); 
}

function tocarSomAlerta() {
    try {
        if (!window.audioCtx) iniciarAudioGlobal();
        const ctx = window.audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
}

// ==========================================
// FORMULÁRIOS
// ==========================================
function prepararNovoAgendamento() {
    document.getElementById('form-id').value = '';
    document.getElementById('form-referencia').value = '';
    document.getElementById('form-valor').value = ''; 
    document.getElementById('form-detalhes').value = '';
    document.getElementById('form-antecedencia').value = '30'; 
    document.getElementById('form-title').innerText = 'Agendar Nova Visita';
    switchTab('form');
}

function prepararEdicao(id) {
    const lembretes = getLembretes();
    const item = lembretes.find(l => l.id === id);
    if (item) {
        document.getElementById('form-id').value = item.id;
        document.getElementById('form-referencia').value = item.nome;
        document.getElementById('form-valor').value = item.valor || ''; 
        document.getElementById('form-detalhes').value = item.texto;
        document.getElementById('form-datahora').value = item.horario;
        document.getElementById('form-antecedencia').value = item.antecedencia || '0';
        
        const acompanhamentoInput = document.querySelector(`input[name="form-acompanhamento"][value="${item.acompanhamento || 'Acompanhar'}"]`);
        if(acompanhamentoInput) acompanhamentoInput.checked = true;
        
        const chaveInput = document.querySelector(`input[name="form-chave"][value="${item.chave || 'Locabens'}"]`);
        if(chaveInput) chaveInput.checked = true;
        
        document.getElementById('form-title').innerText = 'Editar Visita';
        switchTab('form');
    }
}

function salvarAgendamento(e) {
    if (e) e.preventDefault();
    pedirPermissaoNotificacao();
    iniciarAudioGlobal();
    try {
        const idEdicao = document.getElementById('form-id').value;
        const acompanhamentoChecked = document.querySelector('input[name="form-acompanhamento"]:checked');
        const chaveChecked = document.querySelector('input[name="form-chave"]:checked');
        
        const novoItem = {
            id: idEdicao ? parseInt(idEdicao) : Date.now(),
            nome: document.getElementById('form-referencia').value,
            valor: parseFloat(document.getElementById('form-valor').value) || 0, 
            texto: document.getElementById('form-detalhes').value,
            horario: document.getElementById('form-datahora').value,
            antecedencia: parseInt(document.getElementById('form-antecedencia').value) || 0,
            acompanhamento: acompanhamentoChecked ? acompanhamentoChecked.value : 'Acompanhar',
            chave: chaveChecked ? chaveChecked.value : 'Locabens',
            status: `${acompanhamentoChecked ? acompanhamentoChecked.value : 'Acompanhar'} - Chave ${chaveChecked ? chaveChecked.value : 'Locabens'}`
        };
        let lembretes = getLembretes();
        if (idEdicao) {
            const old = lembretes.find(l => l.id == idEdicao);
            if (old && old.resultado) novoItem.resultado = old.resultado;
            lembretes = lembretes.filter(item => item.id != idEdicao);
        }
        lembretes.push(novoItem);
        saveLembretes(lembretes);
        switchTab('list'); 
    } catch (erro) { alert("Erro ao salvar."); }
}

function marcarStatus(id, novoStatus) {
    let lembretes = getLembretes();
    const index = lembretes.findIndex(item => item.id === id);
    if (index !== -1) {
        lembretes[index].resultado = novoStatus;
        saveLembretes(lembretes);
    }
}

function removerLembrete(id) {
    if(confirm('Apagar este agendamento?')) {
        let lembretes = getLembretes();
        lembretes = lembretes.filter(item => item.id !== id);
        saveLembretes(lembretes);
    }
}

// ==========================================
// RENDERIZAÇÃO LISTA
// ==========================================
function limparFiltrosDashboard() { definirFiltroMesAtual(); renderDashboard(); }

function mudarFiltroStatus(btn, status) {
    document.querySelectorAll('.pill-btn').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    filtroStatusAtual = status;
    renderLista();
}

function renderLista() {
    const tbody = document.getElementById('tabela-corpo');
    if(!tbody) return; 
    const termoBusca = document.getElementById('busca-lista').value.toLowerCase();
    let filtrados = getLembretes().filter(item => {
        let st = true;
        if (filtroStatusAtual === 'pendente') st = !item.resultado;
        else if (filtroStatusAtual !== 'todos') st = item.resultado === filtroStatusAtual;
        return st && (item.nome.toLowerCase().includes(termoBusca) || item.texto.toLowerCase().includes(termoBusca));
    });
    filtrados.sort((a, b) => new Date(a.horario) - new Date(b.horario));
    tbody.innerHTML = '';
    filtrados.slice(0, limiteLista).forEach(item => {
        const tr = document.createElement('tr');
        if (item.resultado) tr.classList.add('is-finished');
        const valorFormatado = formatarMoeda(item.valor);
        const dataF = new Date(item.horario).toLocaleString('pt-PT');
        let badge = item.resultado ? `<span class="badge badge-${item.resultado === 'Efetivado' ? 'success' : 'danger'}">${item.resultado}</span>` : `<span class="badge badge-pending">Pendente</span>`;
        
        let acoes = item.resultado ? 
            `<button class="btn-action btn-action-neutral" onclick="marcarStatus(${item.id}, null)"><i class="fa-solid fa-rotate-left"></i></button>` :
            `<button class="btn-action btn-action-success" onclick="marcarStatus(${item.id}, 'Efetivado')"><i class="fa-solid fa-check"></i></button>
             <button class="btn-action btn-action-warning" onclick="marcarStatus(${item.id}, 'Frustrado')"><i class="fa-solid fa-xmark"></i></button>
             <button class="btn-action btn-action-info" onclick="prepararEdicao(${item.id})"><i class="fa-solid fa-pen"></i></button>`;
        
        acoes += `<button class="btn-action btn-action-danger" onclick="removerLembrete(${item.id})"><i class="fa-solid fa-trash"></i></button>`;

        tr.innerHTML = `<td><b>${item.nome}</b><br><small>${item.texto}</small></td><td>${valorFormatado}</td><td>${dataF}</td><td>${item.status}</td><td>${badge}</td><td><div class="actions-group">${acoes}</div></td>`;
        tbody.appendChild(tr);
    });
}

// ==========================================
// DASHBOARD
// ==========================================
function renderDashboard() {
    let lembretes = getLembretes();
    const dataInicio = document.getElementById('dash-data-inicio').value;
    const dataFim = document.getElementById('dash-data-fim').value;
    const agora = new Date();
    
    // Próxima Visita
    const futuros = lembretes
        .filter(item => new Date(item.horario) >= agora && !item.resultado)
        .sort((a, b) => new Date(a.horario) - new Date(b.horario));
        
    const contentProxima = document.getElementById('proxima-visita-content');
    if (contentProxima) {
        if (futuros.length > 0) {
            const proximo = futuros[0];
            const tempoRestante = calcularTempoRestante(proximo.horario); 
            contentProxima.innerHTML = `
                <h3 style="font-size: 1.3rem; font-weight: bold; text-transform: uppercase;">${proximo.nome}</h3>
                <p style="color: var(--text-main); font-size: 1rem; margin-top: 4px; opacity: 0.8;">${proximo.texto}</p>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px;">
                    <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(59, 130, 246, 0.1); color: var(--text-main); padding: 8px 14px; border-radius: 8px; font-weight: bold; font-size: 0.9rem;">
                        <i class="fa-regular fa-calendar-check" style="color: var(--info);"></i> ${new Date(proximo.horario).toLocaleString('pt-PT')}
                    </div>
                    <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(234, 179, 8, 0.1); color: var(--warning); border: 1px solid var(--warning); padding: 8px 14px; border-radius: 8px; font-weight: bold; font-size: 0.9rem;">
                        <i class="fa-solid fa-hourglass-half fa-spin"></i> ${tempoRestante}
                    </div>
                </div>
            `;
        } else {
            contentProxima.innerHTML = `<p style="color: var(--text-muted); font-style: italic;">Nenhuma visita futura agendada no momento.</p>`;
        }
    }

    // Filtros e Gráficos
    let filtrados = lembretes;
    if (dataInicio || dataFim) {
        filtrados = lembretes.filter(item => {
            const dataItemStr = item.horario.split('T')[0];
            const dInicioOk = dataInicio ? dataItemStr >= dataInicio : true;
            const dFimOk = dataFim ? dataItemStr <= dataFim : true;
            return dInicioOk && dFimOk;
        });
    }

    const pendentesList = filtrados.filter(v => !v.resultado);
    const efetivadosList = filtrados.filter(v => v.resultado === 'Efetivado');
    const frustradosList = filtrados.filter(v => v.resultado === 'Frustrado');

    const locabensCount = filtrados.filter(v => v.chave === 'Locabens').length;
    const redentoraCount = filtrados.filter(v => v.chave === 'Redentora').length;

    document.getElementById('count-total').innerText = filtrados.length;
    document.getElementById('count-pendentes').innerText = pendentesList.length;
    document.getElementById('count-efetivados').innerText = efetivadosList.length;
    document.getElementById('count-frustrados').innerText = frustradosList.length;

    const sumTotal = filtrados.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const sumPendentes = pendentesList.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const sumEfetivados = efetivadosList.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const sumFrustrados = frustradosList.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    
    document.getElementById('valor-total').innerText = formatarMoeda(sumTotal);
    document.getElementById('valor-pendentes').innerText = formatarMoeda(sumPendentes);
    document.getElementById('valor-efetivados').innerText = formatarMoeda(sumEfetivados);
    document.getElementById('valor-frustrados').innerText = formatarMoeda(sumFrustrados);

    atualizarGraficos(efetivadosList.length, frustradosList.length, locabensCount, redentoraCount);
}

function atualizarGraficos(efetivados, frustrados, locabens, redentora) {
    // Configurações das cores para os gráficos no modo escuro vs claro
    const isDark = document.body.classList.contains('dark-theme');
    const labelColor = isDark ? '#f8fafc' : '#1e293b';
    
    const ctxConv = document.getElementById('chartConversao');
    if (ctxConv) {
        if (chartConversaoInstancia) chartConversaoInstancia.destroy();
        chartConversaoInstancia = new Chart(ctxConv.getContext('2d'), {
            type: 'doughnut',
            data: { labels: ['Efetivados', 'Frustrados'], datasets: [{ data: [efetivados, frustrados], backgroundColor: ['#16a34a', '#ef4444'], borderWidth: isDark ? 2 : 0, borderColor: isDark ? '#1e293b' : '#fff' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: labelColor } } } }
        });
    }

    const ctxChaves = document.getElementById('chartChaves');
    if (ctxChaves) {
        if (chartChavesInstancia) chartChavesInstancia.destroy();
        chartChavesInstancia = new Chart(ctxChaves.getContext('2d'), {
            type: 'doughnut',
            data: { labels: ['Locabens', 'Redentora'], datasets: [{ data: [locabens, redentora], backgroundColor: ['#3b82f6', '#a855f7'], borderWidth: isDark ? 2 : 0, borderColor: isDark ? '#1e293b' : '#fff' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: labelColor } } } }
        });
    }
}

// ==========================================
// ALERTAS (WEB WORKER COM LOCALSTORAGE)
// ==========================================
function pedirPermissaoNotificacao() {
    if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
}

function mostrarAlerta(mensagem) {
    document.getElementById('alerta-texto').innerText = mensagem;
    document.getElementById('alerta-modal').classList.add('show');
}

function fecharAlerta() { document.getElementById('alerta-modal').classList.remove('show'); }

function iniciarMonitorAlertas() {
    if (workerRelogio) workerRelogio.terminate();
    const workerCode = `setInterval(() => postMessage('check'), 5000);`;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    workerRelogio = new Worker(URL.createObjectURL(blob));

    workerRelogio.onmessage = function() {
        const agora = new Date();
        getLembretes().forEach(item => {
            const alertaKey = `${item.id}_${item.horario}`; 

            if (!item.resultado && !alertasDisparados.includes(alertaKey)) {
                
                const dataVisita = new Date(item.horario);
                const minutosAntecedencia = parseInt(item.antecedencia) || 0;
                const dataAlerta = new Date(dataVisita.getTime() - (minutosAntecedencia * 60000));
                const diff = agora.getTime() - dataAlerta.getTime();
                
                if (diff >= 0 && diff <= 3600000) { 
                    
                    let tempoMsg = minutosAntecedencia > 0 ? `daqui a ${minutosAntecedencia} minutos!` : `AGORA!`;
                    const msg = `⏰ PREPARA-TE:\nA visita de ${item.nome.toUpperCase()} será ${tempoMsg}\n\nDetalhes: ${item.texto}`;
                    
                    mostrarAlerta(msg);
                    tocarSomAlerta();
                    
                    if (Notification.permission === "granted") {
                        const opcoes = { 
                            body: msg, 
                            requireInteraction: true,
                            icon: "https://cdn-icons-png.flaticon.com/512/2693/2693507.png",
                            vibrate: [200, 100, 200]
                        };
                        
                        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                            navigator.serviceWorker.ready.then(reg => {
                                reg.showNotification("LocAgenda", opcoes);
                            }).catch(() => { new Notification("LocAgenda", opcoes); });
                        } else {
                            new Notification("LocAgenda", opcoes);
                        }
                    }
                    
                    alertasDisparados.push(alertaKey);
                    localStorage.setItem('locagenda_alertas', JSON.stringify(alertasDisparados));
                }
            }
        });
        
        const dashAtivo = document.getElementById('tab-dashboard');
        if(dashAtivo && dashAtivo.classList.contains('active')) {
            renderDashboard();
        }
    };
}

// ==========================================
// CALENDÁRIO & DAILY AGENDA
// ==========================================
function renderCalendario() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const hoje = new Date();
    let dataInicio, dataFim;

    if (hoje.getDate() >= 26) {
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 26);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 25);
    } else {
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 26);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), 25);
    }

    const nomeMeses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    document.getElementById('calendar-subtitle').innerText = `Mostrando ciclo: 26 de ${nomeMeses[dataInicio.getMonth()]} até 25 de ${nomeMeses[dataFim.getMonth()]}`;

    const diaSemanaInicio = dataInicio.getDay(); 
    for (let i = 0; i < diaSemanaInicio; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'calendar-day empty';
        grid.appendChild(emptyDiv);
    }

    let dataAtual = new Date(dataInicio);
    const lembretes = getLembretes();

    while (dataAtual <= dataFim) {
        const ano = dataAtual.getFullYear();
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        const dia = String(dataAtual.getDate()).padStart(2, '0');
        const dataString = `${ano}-${mes}-${dia}`;

        const visitasDia = lembretes.filter(item => item.horario.startsWith(dataString));

        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        
        if (dataString === formatarDataParaInput(hoje)) { dayDiv.classList.add('today'); }
        if (dataString === diaSelecionadoCalendario) { dayDiv.classList.add('selected'); }

        let dotsHtml = '';
        if (visitasDia.length > 0) {
            dotsHtml = `<div class="calendar-dots">`;
            const maxDots = Math.min(visitasDia.length, 3);
            for(let i = 0; i < maxDots; i++) {
                let dotClass = 'dot'; 
                if (visitasDia[i].resultado === 'Frustrado') dotClass = 'dot dot-danger';
                else if (visitasDia[i].resultado === 'Efetivado') dotClass = 'dot dot-success';
                dotsHtml += `<div class="${dotClass}"></div>`;
            }
            if(visitasDia.length > 3) { dotsHtml += `<span style="font-size: 0.7rem; color: #64748b; font-weight: bold;">+${visitasDia.length - 3}</span>`; }
            dotsHtml += `</div>`;
        }

        dayDiv.innerHTML = `<span class="calendar-date-num">${dataAtual.getDate()}</span>${dotsHtml}`;

        const dataSalva = dataString;
        dayDiv.onclick = () => {
            diaSelecionadoCalendario = dataSalva;
            renderCalendario(); 
            mostrarVisitasDoDia(dataSalva);
        };

        grid.appendChild(dayDiv);
        dataAtual.setDate(dataAtual.getDate() + 1);
    }
}

function mostrarVisitasDoDia(dataString) {
    const container = document.getElementById('daily-agenda-container');
    const tbody = document.getElementById('daily-agenda-body');
    const title = document.getElementById('daily-agenda-title');
    
    container.style.display = 'block'; 
    
    const partes = dataString.split('-');
    title.innerHTML = `Visitas de <b>${partes[2]}/${partes[1]}/${partes[0]}</b>`;

    const lembretes = getLembretes();
    const visitasDia = lembretes.filter(item => item.horario.startsWith(dataString));

    visitasDia.sort((a, b) => new Date(a.horario) - new Date(b.horario));

    tbody.innerHTML = '';
    if (visitasDia.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 24px; color: var(--text-muted);">Nenhuma visita agendada para este dia. Aproveite para prospectar!</td></tr>`;
        document.getElementById('form-datahora').value = `${dataString}T08:00`;
        return;
    }

    visitasDia.forEach(item => {
        const dataObj = new Date(item.horario);
        const horaFormatada = String(dataObj.getHours()).padStart(2, '0') + ':' + String(dataObj.getMinutes()).padStart(2, '0');
        
        let badgeStatus = `<span class="badge badge-pending">Pendente</span>`;
        if (item.resultado === 'Efetivado') badgeStatus = `<span class="badge badge-success">Efetivado</span>`;
        if (item.resultado === 'Frustrado') badgeStatus = `<span class="badge badge-danger">Frustrado</span>`;

        let acoes = item.resultado ? 
            `<button class="btn-action btn-action-neutral" onclick="marcarStatus(${item.id}, null)"><i class="fa-solid fa-rotate-left"></i></button>` :
            `<button class="btn-action btn-action-success" onclick="marcarStatus(${item.id}, 'Efetivado')"><i class="fa-solid fa-check"></i></button>
             <button class="btn-action btn-action-warning" onclick="marcarStatus(${item.id}, 'Frustrado')"><i class="fa-solid fa-xmark"></i></button>
             <button class="btn-action btn-action-info" onclick="prepararEdicao(${item.id})"><i class="fa-solid fa-pen"></i></button>`;
        
        acoes += `<button class="btn-action btn-action-danger" onclick="removerLembrete(${item.id})"><i class="fa-solid fa-trash"></i></button>`;

        const tr = document.createElement('tr');
        if (item.resultado) tr.style.opacity = '0.7';

        tr.innerHTML = `
            <td>
                <div style="font-weight: bold; text-transform: uppercase;">${item.nome}</div>
                <div style="color: var(--text-muted); font-size: 0.85rem;">${item.texto.substring(0, 40)}${item.texto.length > 40 ? '...' : ''}</div>
            </td>
            <td style="font-weight: 600; color: var(--primary);"><i class="fa-regular fa-clock"></i> ${horaFormatada}</td>
            <td>${badgeStatus}</td>
            <td style="text-align: right;"><div class="actions-group">${acoes}</div></td>
        `;
        tbody.appendChild(tr);
    });

    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    document.getElementById('form-datahora').value = `${dataString}T08:00`;
}

// ==========================================
// EXPORTAÇÃO PARA PDF
// ==========================================
function exportarAgendamentos() {
    const hoje = new Date();
    let dataInicio, dataFim;

    if (hoje.getDate() >= 26) {
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 26);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 25);
    } else {
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 26);
        dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), 25);
    }

    document.getElementById('export-data-inicio').value = formatarDataParaInput(dataInicio);
    document.getElementById('export-data-fim').value = formatarDataParaInput(dataFim);

    document.getElementById('exportar-modal').classList.add('show');
}

function fecharModalExportar() { document.getElementById('exportar-modal').classList.remove('show'); }

function gerarPDF() {
    const dataInicio = document.getElementById('export-data-inicio').value;
    const dataFim = document.getElementById('export-data-fim').value;
    let lembretes = getLembretes();

    if (dataInicio || dataFim) {
        lembretes = lembretes.filter(item => {
            const dataItemStr = item.horario.split('T')[0];
            const dInicioOk = dataInicio ? dataItemStr >= dataInicio : true;
            const dFimOk = dataFim ? dataItemStr <= dataFim : true;
            return dInicioOk && dFimOk;
        });
    }

    if (lembretes.length === 0) {
        alert("Não há agendamentos neste período para exportar.");
        return;
    }

    lembretes.sort((a, b) => new Date(a.horario) - new Date(b.horario));
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Relatório de Agendamentos - LocAgenda", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    const dataInicioPt = dataInicio ? dataInicio.split('-').reverse().join('/') : 'Início';
    const dataFimPt = dataFim ? dataFim.split('-').reverse().join('/') : 'Fim';
    doc.text(`Período filtrado: ${dataInicioPt} a ${dataFimPt}`, 14, 28);

    const colunas = ["Referência", "Valor (R$)", "Detalhes", "Data e Hora", "Status", "Resultado"];
    const linhas = [];

    lembretes.forEach(item => {
        const dataObj = new Date(item.horario);
        const dataFormatada = dataObj.toLocaleDateString('pt-PT') + ' ' + 
                            String(dataObj.getHours()).padStart(2, '0') + ':' + 
                            String(dataObj.getMinutes()).padStart(2, '0');
        
        const valorFormatado = item.valor ? formatarMoeda(item.valor) : 'R$ 0,00';
        
        linhas.push([
            item.nome,
            valorFormatado,
            item.texto,
            dataFormatada,
            item.status,
            item.resultado || 'Pendente'
        ]);
    });

    doc.autoTable({
        head: [colunas],
        body: linhas,
        startY: 35,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [22, 163, 74], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 25 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 25 }, 4: { cellWidth: 25 }, 5: { cellWidth: 22 } }
    });

    const pendentesList = lembretes.filter(v => !v.resultado);
    const efetivadosList = lembretes.filter(v => v.resultado === 'Efetivado');
    const frustradosList = lembretes.filter(v => v.resultado === 'Frustrado');

    const sumTotal = lembretes.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const sumPendentes = pendentesList.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const sumEfetivados = efetivadosList.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const sumFrustrados = frustradosList.reduce((acc, curr) => acc + (curr.valor || 0), 0);

    let finalY = doc.lastAutoTable.finalY;
    if (finalY > 250) {
        doc.addPage();
        finalY = 20;
    } else {
        finalY += 15;
    }

    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59); 
    doc.setFont("helvetica", "bold");
    doc.text("Resumo do Período", 14, finalY);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    doc.text(`Total de Visitas: ${lembretes.length}`, 14, finalY + 8);
    doc.text(`Pendentes: ${pendentesList.length}`, 14, finalY + 14);
    doc.text(`Efetivados: ${efetivadosList.length}`, 14, finalY + 20);
    doc.text(`Frustrados: ${frustradosList.length}`, 14, finalY + 26);
    
    doc.text(`Valor Total: ${formatarMoeda(sumTotal)}`, 80, finalY + 8);
    doc.text(`Valor Pendentes: ${formatarMoeda(sumPendentes)}`, 80, finalY + 14);
    doc.text(`Valor Efetivados: ${formatarMoeda(sumEfetivados)}`, 80, finalY + 20);
    doc.text(`Valor Frustrados: ${formatarMoeda(sumFrustrados)}`, 80, finalY + 26);

    fecharModalExportar();
    const nomeFicheiro = `LocAgenda_Relatorio_${dataInicioPt}_a_${dataFimPt}.pdf`.replace(/\//g, '-');
    doc.save(nomeFicheiro);
}