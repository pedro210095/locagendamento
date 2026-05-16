// ==========================================
// VARIÁVEIS GLOBAIS E ESTADO DO SISTEMA (v2.0)
// ==========================================
let lembretesLocais = [];
let agendamentosRef = null;
let perfilRef = null; 
let usuarioLogadoUid = null;

// Novo Estado Bitêmico
let contextoDashboardAtual = 'Locação'; // Alterna entre 'Locação' e 'Venda'

// Nova Estrutura de Configurações Global
let configGeral = {
    perfil: { nomeProfissional: '' },
    locacao: { meta: 5000, comissao: 10, superComissao: 12 },
    venda: { meta: 1000000, comissao: 1.5, superComissao: 2 },
    agenda: { horaInicio: '08:00', horaFim: '18:00', duracao: '30', dias: [1,2,3,4,5,6] }
};

// ==========================================
// FUNÇÃO DE SEGURANÇA (ANTI-XSS)
// ==========================================
function sanitizarTexto(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, match => ({
        '&': '&amp;', 
        '<': '&lt;', 
        '>': '&gt;', 
        "'": '&#39;', 
        '"': '&quot;'
    })[match]);
}
window.sanitizarTexto = sanitizarTexto;

// Controlo de Calendário e UI
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
// TEMA E INTERFACE
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

window.switchConfigTab = function(tabNome) {
    document.querySelectorAll('.mini-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.config-panel').forEach(el => el.classList.remove('active'));
    
    document.getElementById(`tab-btn-${tabNome}`).classList.add('active');
    document.getElementById(`panel-${tabNome}`).classList.add('active');
};

window.mudarContextoDashboard = function(contexto) {
    contextoDashboardAtual = contexto;
    
    document.querySelectorAll('.dash-toggle-btn').forEach(btn => btn.classList.remove('active'));
    if(contexto === 'Locação') document.getElementById('toggle-locacao').classList.add('active');
    else document.getElementById('toggle-venda').classList.add('active');
    
    renderDashboard();
};

// ==========================================
// CONFIGURAÇÕES GLOBAIS (PERFIL, METAS E AGENDA)
// ==========================================
window.salvarConfiguracoesGlobais = function(evento) {
    evento.preventDefault();
    
    const checkboxes = document.querySelectorAll('input[name="config-dia"]:checked');
    const diasSelecionados = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    configGeral = {
        perfil: {
            nomeProfissional: document.getElementById('config-nome-profissional').value
        },
        locacao: {
            meta: parseFloat(document.getElementById('config-meta-locacao').value) || 0,
            comissao: parseFloat(document.getElementById('config-comissao-locacao').value) || 0,
            superComissao: parseFloat(document.getElementById('config-super-comissao-locacao').value) || 0
        },
        venda: {
            meta: parseFloat(document.getElementById('config-meta-venda').value) || 0,
            comissao: parseFloat(document.getElementById('config-comissao-venda').value) || 0,
            superComissao: parseFloat(document.getElementById('config-super-comissao-venda').value) || 0
        },
        agenda: {
            horaInicio: document.getElementById('config-hora-inicio').value,
            horaFim: document.getElementById('config-hora-fim').value,
            duracao: document.getElementById('config-duracao').value,
            dias: diasSelecionados
        }
    };

    if (perfilRef) {
        window.dbUpdate(perfilRef, { configGeral: configGeral })
        .then(() => {
            alert("Configurações salvas com sucesso!");
            renderDashboard();
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
        alert("Link copiado com sucesso! Partilhe com os seus clientes.");
    }).catch(err => {
        console.error('Falha ao copiar o link: ', err);
        alert("Não foi possível copiar o link.");
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
// MENSAGENS WHATSAPP
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
           `🔑 *Chave:* ${item.chave}\n\n` +
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
            // --- 1. LÓGICA DE VISUALIZAÇÃO MASTER (MODO SUPORTE) ---
            let uidParaCarregar = user.uid; // Por padrão, carrega os seus próprios dados
            const viewAsUid = sessionStorage.getItem('admin_view_as_uid');
            const viewAsName = sessionStorage.getItem('admin_view_as_name');

            // Se você for o Admin e houver um UID alvo na memória da sessão
            if (user.email === "pedro210095@gmail.com" && viewAsUid) {
                uidParaCarregar = viewAsUid; // Altera o alvo do carregamento para o outro corretor
                
                // Exibe o banner de aviso (certifique-se de ter a função mostrarAvisoModoSuporte no java.js)
                if (typeof mostrarAvisoModoSuporte === "function") {
                    mostrarAvisoModoSuporte(viewAsName);
                }
            }
            // -------------------------------------------------------

            usuarioLogadoUid = user.uid; // O seu UID real para controle interno
            garantirEmailNoBanco(user); // Sincroniza o seu e-mail
            // --- REGISTAR ÚLTIMO ACESSO ---
            if (uidParaCarregar === user.uid) {
                const pRef = window.dbRef(window.db, `usuarios/${user.uid}/perfil`);
                window.dbUpdate(pRef, { ultimoAcesso: Date.now() });
            }

            // Revelar porta secreta para o Admin Master
            if (user.email === "pedro210095@gmail.com") {
                const btnAdmin = document.getElementById('btn-admin-master');
                if (btnAdmin) btnAdmin.style.display = 'flex';
            }
                        
            let urlBase = window.location.href.split('index.html')[0];
            if(!urlBase.endsWith('/')) urlBase += '/';
            document.getElementById('config-link-publico').value = `${urlBase}agendar.html?id=${user.uid}`;

            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container-main').style.display = 'flex';
            // Dentro de monitorarAutenticacao, após mostrar o app:
            const abaSalva = localStorage.getItem('locagenda_active_tab') || 'dashboard';
            switchTab(abaSalva);
            
            // --- 2. CARREGAMENTO DINÂMICO DOS DADOS ---
            // Repare que agora usamos 'uidParaCarregar' nas referências do Firebase
            agendamentosRef = window.dbRef(window.db, `usuarios/${uidParaCarregar}/agendamentos`);
            window.dbOnValue(agendamentosRef, (snap) => {
                lembretesLocais = snap.val() ? Object.values(snap.val()) : [];
                renderDashboard(); 
                renderLista(); 
                renderCalendario();
                
                // Mantém a sua lógica do calendário
                if(diaSelecionadoCalendario) mostrarVisitasDoDia(diaSelecionadoCalendario);
                
                // ADICIONE ESTA LINHA: 
                // Ela envia os horários ocupados para o nó público toda vez que houver alteração
                sincronizarAgendaPublica(); 
            });

            perfilRef = window.dbRef(window.db, `usuarios/${uidParaCarregar}/perfil`);
            window.dbOnValue(perfilRef, (snap) => {
                if(snap.exists()) {
                    const dados = snap.val();
                    // NOVO: Esta é a linha mágica que avisa o sistema que você é de uma Imobiliária!
                    window.usuarioImobiliariaId = dados.imobiliariaId || null;

                    // === MOSTRAR BOTÃO DO GESTOR SE TIVER ACESSO ===
                    const btnGestor = document.getElementById('btn-gestor-panel');
                    if (btnGestor) {
                        if (dados.nivelAcesso === 'gestor' && dados.imobiliariaId) {
                            btnGestor.style.display = 'flex';
                        } else {
                            btnGestor.style.display = 'none';
                        }
                    }
                    
                    // =======================================================
                    // TRAVA DE SEGURANÇA (COLE ESTE BLOCO EXATAMENTE AQUI)
                    // =======================================================
                    // 1. Verifica se o UID carregado é o do utilizador logado
                    // 2. Verifica se o status no banco é 'suspenso'
                    // 3. IMUNIDADE: Se o email for o seu (Master), ele ignora a trava
                    if (uidParaCarregar === user.uid && dados.status === 'suspenso' && user.email !== "pedro210095@gmail.com") {
                        alert("⚠️ Esta conta foi suspensa pelo Administrador Master. O acesso ao sistema está bloqueado.");
                        window.logout(); 
                        window.location.reload(); 
                        return; // Para a execução aqui
                    }
                    // -------------------------------------------------------

                    // Lógica de migração e carregamento de configurações
                    if (dados.configGeral) {
                        configGeral = dados.configGeral;
                    } else {
                        if(dados.comissao !== undefined) configGeral.locacao.comissao = dados.comissao;
                        if(dados.configAgenda) configGeral.agenda = dados.configAgenda;
                    }
                    
                    // Preenchimento do formulário de configurações
                    document.getElementById('config-nome-profissional').value = configGeral.perfil?.nomeProfissional || '';
                    document.getElementById('config-meta-locacao').value = configGeral.locacao?.meta || '';
                    document.getElementById('config-comissao-locacao').value = configGeral.locacao?.comissao || '';
                    document.getElementById('config-super-comissao-locacao').value = configGeral.locacao?.superComissao || '';
                    
                    document.getElementById('config-meta-venda').value = configGeral.venda?.meta || '';
                    document.getElementById('config-comissao-venda').value = configGeral.venda?.comissao || '';
                    document.getElementById('config-super-comissao-venda').value = configGeral.venda?.superComissao || '';

                    document.getElementById('config-hora-inicio').value = configGeral.agenda?.horaInicio || '08:00';
                    document.getElementById('config-hora-fim').value = configGeral.agenda?.horaFim || '18:00';
                    document.getElementById('config-duracao').value = configGeral.agenda?.duracao || '30';
                    
                    const checkboxes = document.querySelectorAll('input[name="config-dia"]');
                    const diasAtivos = configGeral.agenda?.dias || [1,2,3,4,5,6];
                    checkboxes.forEach(cb => { cb.checked = diasAtivos.includes(parseInt(cb.value)); });

                    // =======================================================
                    // NOVO: SINCRONIZAÇÃO DE METAS DA IMOBILIÁRIA (GESTOR -> CORRETOR)
                    // =======================================================
                    if (window.usuarioImobiliariaId) {
                        const imobRef = window.dbRef(window.db, `imobiliarias/${window.usuarioImobiliariaId}`);
                        window.dbOnValue(imobRef, (imobSnap) => {
                            if (imobSnap.exists()) {
                                const imobData = imobSnap.val();
                                if (imobData.metas) {
                                    // Sincroniza dados na memória
                                    configGeral.locacao = imobData.metas.locacao;
                                    configGeral.venda = imobData.metas.venda;
                                    
                                    // Bloqueia campos de Locação
                                    const idsLoc = ['config-meta-locacao', 'config-comissao-locacao', 'config-super-comissao-locacao'];
                                    idsLoc.forEach(id => { 
                                        const el = document.getElementById(id);
                                        if(el) {
                                            const prop = id.includes('super') ? 'superComissao' : id.split('-')[1];
                                            el.value = configGeral.locacao[prop] || 0;
                                            el.disabled = true;
                                        }
                                    });

                                    // Bloqueia campos de Venda
                                    const idsVen = ['config-meta-venda', 'config-comissao-venda', 'config-super-comissao-venda'];
                                    idsVen.forEach(id => {
                                        const el = document.getElementById(id);
                                        if(el) {
                                            const prop = id.includes('super') ? 'superComissao' : id.split('-')[1];
                                            el.value = configGeral.venda[prop] || 0;
                                            el.disabled = true;
                                        }
                                    });
                                    
                                    mostrarAvisoMetaEquipa();
                                }
                            }
                            renderDashboard(); 
                        });
                    } else {
                        renderDashboard();
                    }
                }
            });
        } else {
            // === NOVO BLOCO ADICIONADO AQUI ===
            // Se não houver utilizador logado, mostra o ecrã de login
            const loginScreen = document.getElementById('login-screen');
            const appContainer = document.getElementById('app-container-main');
            
            if(loginScreen) loginScreen.style.display = 'flex';
            if(appContainer) appContainer.style.display = 'none';
            // =================================
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
    } catch(e) { console.error("Erro ao carregar o calendário:", e); }

    definirFiltroMesAtual(); 
    monitorarAutenticacao(); 
    
    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
    
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

    // NOVO: Salva a aba atual na memória do navegador
    localStorage.setItem('locagenda_active_tab', tabNome);
    
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

    const radioChave = document.querySelector(`input[name="form-chave"][value="${item.chave}"]`);
    if (radioChave) {
        radioChave.checked = true;
    } else if (item.retiradaChave && document.querySelector(`input[name="form-chave"][value="${item.retiradaChave}"]`)) {
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
        retiradaChave: '', 
        status: `${valAcomp} - Chave: ${valChave}`
    };
    
    let listaAtualizada = lembretesLocais.filter(i => i.id != novoItem.id);
    const itemAntigo = lembretesLocais.find(i => i.id == novoItem.id);
    if(itemAntigo && itemAntigo.resultado) novoItem.resultado = itemAntigo.resultado;
    
    listaAtualizada.push(novoItem);
    
    if (agendamentosRef) window.dbSet(agendamentosRef, listaAtualizada);
    switchTab('list');
}
window.salvarAgendamento = salvarAgendamento;

// Variável temporária para segurar o ID da visita enquanto o modal está aberto
let idAcaoPendente = null;

// ==========================================
// 1. LÓGICA DE FRUSTRAÇÃO DE VISITA
// ==========================================
window.marcarStatus = function(id, statusSelecionado) {
    let listaCopia = [...lembretesLocais];
    const index = listaCopia.findIndex(x => x.id === id);
    if (index === -1) return;

    if (statusSelecionado === 'Frustrado' && window.usuarioImobiliariaId) {
        // Abre o modal bonito em vez do antigo prompt()
        idAcaoPendente = id;
        document.getElementById('input-motivo-frustracao').value = '';
        document.getElementById('modal-motivo-frustracao').classList.add('show');
        return; // Interrompe a função aqui. O restante acontece ao clicar no botão confirmar
    } 
    else if (statusSelecionado === null) {
        listaCopia[index].feedbackCorretor = ''; // Limpa o feedback ao reverter
    }
    
    listaCopia[index].resultado = statusSelecionado; 
    if(agendamentosRef) window.dbSet(agendamentosRef, listaCopia); 
};

window.fecharModalFrustracao = function() {
    document.getElementById('modal-motivo-frustracao').classList.remove('show');
    idAcaoPendente = null;
};

window.confirmarFrustracao = function() {
    const feedback = document.getElementById('input-motivo-frustracao').value;
    if (feedback.trim() === '') {
        alert("O motivo da frustração é obrigatório.");
        return; 
    }

    let listaCopia = [...lembretesLocais];
    const index = listaCopia.findIndex(x => x.id === idAcaoPendente);
    
    if (index !== -1) {
        listaCopia[index].feedbackCorretor = feedback;
        listaCopia[index].resultado = 'Frustrado';
        if(agendamentosRef) window.dbSet(agendamentosRef, listaCopia);
    }
    
    fecharModalFrustracao();
};

// ==========================================
// 2. LÓGICA DE EXCLUSÃO DE VISITA
// ==========================================
window.removerLembrete = function(id) { 
    idAcaoPendente = id;

    if (window.usuarioImobiliariaId) {
        // Modal de Lixeira/Auditoria do Gestor
        document.getElementById('input-motivo-exclusao').value = '';
        document.getElementById('modal-motivo-exclusao').classList.add('show');
    } else {
        // Modal de confirmação simples para Corretor Solo
        document.getElementById('modal-confirmar-exclusao-solo').classList.add('show');
    }
};

window.fecharModalExclusao = function() { 
    document.getElementById('modal-motivo-exclusao').classList.remove('show'); 
    idAcaoPendente = null; 
};

window.confirmarExclusao = function() {
    const motivo = document.getElementById('input-motivo-exclusao').value;
    if (motivo.trim() === '') {
        alert("É obrigatório informar o motivo da exclusão.");
        return;
    }

    let listaCopia = [...lembretesLocais];
    const index = listaCopia.findIndex(x => x.id === idAcaoPendente);
    
    if (index !== -1) {
        listaCopia[index].resultado = 'Excluído';
        listaCopia[index].motivoExclusao = motivo;
        listaCopia[index].ocultoCorretor = true; 
        listaCopia[index].dataExclusao = Date.now();
        if(agendamentosRef) window.dbSet(agendamentosRef, listaCopia);
    }
    fecharModalExclusao();
};

window.fecharModalExclusaoSolo = function() { 
    document.getElementById('modal-confirmar-exclusao-solo').classList.remove('show'); 
    idAcaoPendente = null; 
};

window.confirmarExclusaoSolo = function() {
    const filtrada = lembretesLocais.filter(i => i.id !== idAcaoPendente);
    if(agendamentosRef) window.dbSet(agendamentosRef, filtrada);
    fecharModalExclusaoSolo();
};

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
        // NOVO: Esconde as visitas da lixeira para que o corretor não as veja mais
        if (item.ocultoCorretor) return false;

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

        const detalhesVisita = item.texto ? window.sanitizarTexto(item.texto) : 'Sem detalhes informados';

        let feedbackHtml = '';
        if (item.feedbackCorretor) {
            feedbackHtml = `<br><small style="color: #e99c0e; font-weight: 600;"><i class="fa-solid fa-reply"></i> Frustrado: ${window.sanitizarTexto(item.feedbackCorretor)}</small>`;
        }
        
        // Mostra o tipo (Venda/Locação) ao lado do valor na lista
        const tipoBadge = `<span style="font-size: 0.75rem; color: #64748b; display:block;">${item.tipo || 'Locação'}</span>`;
        
        // O feedbackHtml é injetado no final da primeira coluna
        tr.innerHTML = `<td><b>${window.sanitizarTexto(item.nome)}</b><br><small>${detalhesVisita}</small>${feedbackHtml}</td><td>${formatarMoeda(item.valor)}${tipoBadge}</td><td>${dataFormatada}</td><td>${item.status}</td><td>${badge}</td><td style="text-align:right;">${acoes}</td>`;
        
        tbody.appendChild(tr);
    });
}
window.renderLista = renderLista;

// ==========================================
// RENDERIZAÇÃO DO PAINEL DE CONTROLE (V2.0 BITÊMICO)
// ==========================================
function renderDashboard() {
    // NOVO: Remove os itens da lixeira logo à partida para não inflacionar os totais
    let dadosBrutos = lembretesLocais.filter(item => !item.ocultoCorretor) || [];
    const dataInicioStr = document.getElementById('dash-data-inicio') ? document.getElementById('dash-data-inicio').value : null;
    const dataFimStr = document.getElementById('dash-data-fim') ? document.getElementById('dash-data-fim').value : null;
    const tempoAgora = new Date();
    
    // Próxima Visita (Independente do contexto Locação/Venda)
    const proximasVisitas = dadosBrutos.filter(item => item.horario && new Date(item.horario) >= tempoAgora && !item.resultado).sort((a, b) => new Date(a.horario) - new Date(b.horario));
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

    // Filtro 1: Por Data
    if (dataInicioStr || dataFimStr) {
        dadosBrutos = dadosBrutos.filter(item => {
            if(!item.horario) return false;
            const dataPura = item.horario.split('T')[0];
            return (!dataInicioStr || dataPura >= dataInicioStr) && (!dataFimStr || dataPura <= dataFimStr);
        });
    }

    // Filtro 2: Pelo Contexto Atual (Locação vs Venda)
    const dadosContexto = dadosBrutos.filter(item => {
        // Se o item for antigo e não tiver 'tipo', assume como Locação.
        const tipoReal = item.tipo || 'Locação'; 
        return tipoReal === contextoDashboardAtual;
    });

    // Separação de Status do Contexto
    const arrayEfetivados = dadosContexto.filter(v => v.resultado === 'Efetivado');
    const arrayFrustrados = dadosContexto.filter(v => v.resultado === 'Frustrado');
    const arrayPendentes = dadosContexto.filter(v => !v.resultado);

    const somaTotal = dadosContexto.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const somaEfetivados = arrayEfetivados.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const somaPendentes = arrayPendentes.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const somaFrustrados = arrayFrustrados.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    
    // Atualiza os cartões básicos
    if(document.getElementById('count-total')) document.getElementById('count-total').innerText = dadosContexto.length;
    if(document.getElementById('count-pendentes')) document.getElementById('count-pendentes').innerText = arrayPendentes.length;
    if(document.getElementById('count-efetivados')) document.getElementById('count-efetivados').innerText = arrayEfetivados.length;
    if(document.getElementById('count-frustrados')) document.getElementById('count-frustrados').innerText = arrayFrustrados.length;

    if(document.getElementById('valor-total')) document.getElementById('valor-total').innerText = formatarMoeda(somaTotal);
    if(document.getElementById('valor-pendentes')) document.getElementById('valor-pendentes').innerText = formatarMoeda(somaPendentes);
    if(document.getElementById('valor-efetivados')) document.getElementById('valor-efetivados').innerText = formatarMoeda(somaEfetivados);
    if(document.getElementById('valor-frustrados')) document.getElementById('valor-frustrados').innerText = formatarMoeda(somaFrustrados);

    // ==========================================
    // LÓGICA DE METAS E SUPER COMISSÃO (v2.0)
    // ==========================================
    const chaveConfig = contextoDashboardAtual === 'Locação' ? 'locacao' : 'venda';
    const configAtiva = configGeral[chaveConfig];
    
    const metaDoMes = configAtiva.meta || 1; // Previne divisão por zero
    let percentualAtingido = (somaEfetivados / metaDoMes) * 100;
    
    // Define a comissão baseada no atingimento da meta
    let taxaComissaoAplicada = configAtiva.comissao || 0;
    let textoStatusComissao = "Taxa Padrão";
    let isSuper = false;

    if (percentualAtingido >= 100) {
        taxaComissaoAplicada = configAtiva.superComissao || configAtiva.comissao;
        textoStatusComissao = "🔥 COMISSÃO ATINGIDA!";
        isSuper = true;
        percentualAtingido = 100; // Trava a barra visualmente em 100%
    }

    const valorComissaoCalculado = somaEfetivados * (taxaComissaoAplicada / 100);

    // Atualiza UI de Metas e Comissões
    if(document.getElementById('titulo-meta')) document.getElementById('titulo-meta').innerText = `Progresso da Meta (${contextoDashboardAtual})`;
    if(document.getElementById('valor-atingido-meta')) document.getElementById('valor-atingido-meta').innerText = formatarMoeda(somaEfetivados);
    if(document.getElementById('texto-objetivo-meta')) document.getElementById('texto-objetivo-meta').innerText = `Objetivo: ${formatarMoeda(metaDoMes)}`;
    
    if(document.getElementById('percentual-meta')) document.getElementById('percentual-meta').innerText = `${percentualAtingido.toFixed(1)}%`;
    if(document.getElementById('status-super-comissao')) {
        const elStatus = document.getElementById('status-super-comissao');
        elStatus.innerText = textoStatusComissao;
        elStatus.style.color = isSuper ? 'var(--primary)' : 'var(--text-muted)';
    }
    
    if(document.getElementById('barra-meta')) {
        const barra = document.getElementById('barra-meta');
        barra.style.width = `${percentualAtingido}%`;
        if (isSuper) barra.classList.add('super-bonus');
        else barra.classList.remove('super-bonus');
    }

    if(document.getElementById('valor-comissao')) document.getElementById('valor-comissao').innerText = formatarMoeda(valorComissaoCalculado);
    if(document.getElementById('texto-percentual-comissao')) {
        const elPerc = document.getElementById('texto-percentual-comissao');
        elPerc.innerText = `Taxa Aplicada: ${taxaComissaoAplicada}%`;
        elPerc.style.color = isSuper ? 'var(--warning)' : 'var(--primary)';
    }

    // Chama os gráficos passando apenas os dados filtrados do contexto atual
    atualizarGraficosCorporativos(dadosContexto);
}

function atualizarGraficosCorporativos(dadosGraficos) {
    const temaEscuroAtivo = document.body.classList.contains('dark-theme');
    const corTexto = temaEscuroAtivo ? '#f8fafc' : '#1e293b';
    const corGrelha = temaEscuroAtivo ? '#334155' : '#e2e8f0';

    let acompanhouSim = 0, acompanhouNao = 0;
    let chavesLocabens = 0, chavesRedentora = 0;
    
    let bairrosEfetivados = {};
    let bairrosFrustrados = {};
    let bairrosTotal = {};

    dadosGraficos.forEach(visita => { 
        if (visita.resultado === 'Efetivado') {
            if(visita.acompanhamento === 'Acompanhar') acompanhouSim++; 
            else if(visita.acompanhamento === 'Não Acompanhar') acompanhouNao++; 
            
            if(visita.chave === 'Locabens') chavesLocabens++;
            else if (visita.chave === 'Redentora') chavesRedentora++;
        }

        if (visita.resultado === 'Efetivado' || visita.resultado === 'Frustrado') {
            let nomeBairro = visita.bairro ? visita.bairro.trim() : '';
            if(nomeBairro === '') nomeBairro = 'Não Informado';

            if (visita.resultado === 'Efetivado') {
                bairrosEfetivados[nomeBairro] = (bairrosEfetivados[nomeBairro] || 0) + 1;
            } else if (visita.resultado === 'Frustrado') {
                bairrosFrustrados[nomeBairro] = (bairrosFrustrados[nomeBairro] || 0) + 1;
            }
            
            bairrosTotal[nomeBairro] = (bairrosTotal[nomeBairro] || 0) + 1;
        }
    });

    let bairrosOrdenados = Object.keys(bairrosTotal).sort((a,b) => bairrosTotal[b] - bairrosTotal[a]).slice(0, 5);
    
    let dadosEfetivadosArray = bairrosOrdenados.map(b => bairrosEfetivados[b] || 0);
    let dadosFrustradosArray = bairrosOrdenados.map(b => bairrosFrustrados[b] || 0);

    if(document.getElementById('titulo-grafico-bairros')) {
        document.getElementById('titulo-grafico-bairros').innerText = `Eficiência por Bairro (${contextoDashboardAtual})`;
    }

    // --- LÓGICA DE EXIBIÇÃO BITÊMICA DOS GRÁFICOS ---
    const ctx1 = document.getElementById('chartChaves');
    const ctx2 = document.getElementById('chartAcompanhamento');
    
    // Captura as divs "cartão" que englobam os canvas
    const cardChaves = ctx1 ? ctx1.closest('.stat-card') : null;
    const cardAcomp = ctx2 ? ctx2.closest('.stat-card') : null;

    if (contextoDashboardAtual === 'Venda') {
        // Esconde os gráficos menores em Vendas
        if (cardChaves) cardChaves.style.display = 'none';
        if (cardAcomp) cardAcomp.style.display = 'none';
    } else {
        // Mostra os gráficos menores em Locação
        if (cardChaves) cardChaves.style.display = 'flex';
        if (cardAcomp) cardAcomp.style.display = 'flex';

        // 1. Renderiza Chaves (Rosca)
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

        // 2. Renderiza Acompanhamento (Rosca)
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
    }

    // 3. Eficiência por Bairro (Renderiza sempre, mas ajustado ao contexto)
    const ctx4 = document.getElementById('chartBairros');
    if (ctx4) {
        if (chartBairrosInstancia) chartBairrosInstancia.destroy();
        chartBairrosInstancia = new Chart(ctx4.getContext('2d'), { 
            type: 'bar', 
            data: { 
                labels: bairrosOrdenados, 
                datasets: [
                    { 
                        label: 'Efetivados (Sucesso)', 
                        data: dadosEfetivadosArray, 
                        backgroundColor: '#10b981', 
                        borderRadius: 4 
                    },
                    { 
                        label: 'Frustrados (Perda)', 
                        data: dadosFrustradosArray, 
                        backgroundColor: '#ef4444', 
                        borderRadius: 4 
                    }
                ] 
            }, 
            options: { 
                indexAxis: 'y', 
                plugins: { 
                    legend: { display: true, labels: { color: corTexto, usePointStyle: true, boxWidth: 8 } },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: { 
                    x: { stacked: true, ticks: { color: corTexto, stepSize: 1 }, grid: { color: corGrelha } }, 
                    y: { stacked: true, ticks: { color: corTexto }, grid: { display: false } } 
                },
                maintainAspectRatio: false 
            } 
        });
    }
}

// ==========================================
// ALERTAS DE TEMPO SEGUROS E CALENDÁRIO
// ==========================================
function verificarAlertas() {
    const tempoMomento = new Date().getTime();

    lembretesLocais.forEach(visita => {
        if (visita.resultado || !visita.horario) return;

        const tempoVisita = new Date(visita.horario).getTime();
        const antecedenciaMinutos = parseInt(visita.antecedencia) || 0;
        const antecedenciaMs = antecedenciaMinutos * 60000;

        if (antecedenciaMinutos > 0) {
            const chaveAviso = `aviso_${visita.id}_${visita.horario}`;
            const momentoAviso = tempoVisita - antecedenciaMs;

            if (tempoMomento >= momentoAviso && tempoMomento < tempoVisita && !alertasDisparados.includes(chaveAviso)) {
                mostrarNotificacao(
                    `⏳ Lembrete: Faltam ${antecedenciaMinutos} minutos!`,
                    `A visita de ${visita.nome.toUpperCase()} acontecerá em breve.`,
                    chaveAviso
                );
            }
        }

        const chaveHora = `hora_${visita.id}_${visita.horario}`;
        if (tempoMomento >= tempoVisita && (tempoMomento - tempoVisita) <= 3600000 && !alertasDisparados.includes(chaveHora)) {
            mostrarNotificacao(
                `⏰ Está na hora da visita!`,
                `Cliente: ${visita.nome.toUpperCase()}. Tenha um excelente atendimento!`,
                chaveHora
            );
        }
    });
}

function mostrarNotificacao(titulo, mensagem, chaveSalvar) {
    const textoModal = document.getElementById('alerta-texto');
    if (textoModal) {
        textoModal.innerHTML = `<strong style="color: var(--text-main); font-size: 1.1rem; display: block; margin-bottom: 4px;">${titulo}</strong>${mensagem}`;
        document.getElementById('alerta-modal').classList.add('show');
    }

    if ("Notification" in window && Notification.permission === "granted") {
        new Notification("LocAgenda", {
            body: `${titulo}\n${mensagem}`,
            requireInteraction: true,
            vibrate: [200, 100, 200]
        });
    }

    alertasDisparados.push(chaveSalvar);
    localStorage.setItem('locagenda_alertas', JSON.stringify(alertasDisparados));
}

window.fecharAlerta = function() { 
    document.getElementById('alerta-modal').classList.remove('show'); 
};

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
    if(mesDisplay) mesDisplay.innerText = `${mesesNomes[mesAtualCalendario]} ${anoAtualCalendario}`;
    
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
        
        // NOVO: Adicionado && !v.ocultoCorretor
        const visitasDesseDia = lembretesLocais.filter(v => v.horario && v.horario.startsWith(dStringFormatada) && !v.ocultoCorretor);
        const celulaDia = document.createElement('div');
        celulaDia.className = `calendar-day ${dStringFormatada === diaSelecionadoCalendario ? 'selected' : ''}`;
        
        const hojeRef = new Date();
        const hojeString = `${hojeRef.getFullYear()}-${String(hojeRef.getMonth() + 1).padStart(2, '0')}-${String(hojeRef.getDate()).padStart(2, '0')}`;
        if (dStringFormatada === hojeString) celulaDia.classList.add('today');
        
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
    
    // NOVO: Adicionado && !i.ocultoCorretor
    const visitasFiltradas = lembretesLocais.filter(i => i.horario && i.horario.startsWith(dString) && !i.ocultoCorretor).sort((a,b) => new Date(a.horario) - new Date(b.horario));
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
// EXPORTAÇÃO PDF & CSV (ATUALIZADO V2.0)
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
        // NOVO: Ignora também se estiver ocultoCorretor
        if (!item.horario || item.ocultoCorretor) return false;
        const dataComparacao = item.horario.split('T')[0];
        return (!strInicio || dataComparacao >= strInicio) && (!strFim || dataComparacao <= strFim);
    }).sort((a,b) => new Date(a.horario) - new Date(b.horario));
}

window.gerarCSV = function() {
    const listaDados = aplicarFiltroParaExportacao();
    if (listaDados.length === 0) { alert("Nenhuma visita encontrada."); return; }
    let conteudoArquivo = "\uFEFF"; 
    conteudoArquivo += "Data/Hora;Cliente;CEP;Rua;Numero;Complemento;Bairro;Cidade;Tipo;Valor(R$);Acompanhamento;Chave;Status;Observacoes\n";
    listaDados.forEach(visita => {
        const dtStr = new Date(visita.horario).toLocaleString('pt-PT');
        conteudoArquivo += `${dtStr};"${visita.nome}";"${visita.cep||''}";"${visita.rua||''}";"${visita.numero||''}";"${visita.complemento||''}";"${visita.bairro||''}";"${visita.cidade||''}";"${visita.tipo||'Locação'}";${visita.valor||0};"${visita.acompanhamento}";"${visita.chave}";"${visita.resultado||'Pendente'}";"${(visita.texto||'').replace(/\n/g, ' ')}"\n`;
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
    
    // NOME PROFISSIONAL GLOBAL (Recurso v2.0)
    let nomeCorretor = configGeral.perfil?.nomeProfissional;
    if (!nomeCorretor || nomeCorretor.trim() === '') {
        nomeCorretor = (window.auth && window.auth.currentUser) ? window.auth.currentUser.displayName : "Corretor(a)";
    }

    doc.setFontSize(22);
    doc.setTextColor(22, 163, 74); 
    doc.text("LOCAGENDA", 14, 18);
    
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text(`Corretor(a): ${nomeCorretor}`, 14, 26);

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

    if (tipoPDF === 'lista') {
        const colunas = ["Data/Hora", "Cliente", "Tipo", "Endereço", "Acompanhamento", "Chave", "Status"];
        const linhas = listaDados.map(i => [
            new Date(i.horario).toLocaleString('pt-PT', {dateStyle: 'short', timeStyle: 'short'}), 
            i.nome, 
            i.tipo || 'Locação',
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
                if (data.section === 'body' && data.column.index === 6) {
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

    } else {
        const totalVisitas = listaDados.length;
        const ef = listaDados.filter(v => v.resultado === 'Efetivado');
        const fr = listaDados.filter(v => v.resultado === 'Frustrado');
        const pe = listaDados.filter(v => !v.resultado);

        const taxaConversao = totalVisitas > 0 ? ((ef.length / totalVisitas) * 100).toFixed(1) : 0;

        const locabens = listaDados.filter(v => v.chave === 'Locabens').length;
        const redentora = listaDados.filter(v => v.chave === 'Redentora').length;
        const acomp = listaDados.filter(v => v.acompanhamento === 'Acompanhar').length;
        const nAcomp = listaDados.filter(v => v.acompanhamento === 'Não Acompanhar').length;

        doc.autoTable({
             startY: 50,
             head: [["1. Indicadores de Conversão", "Quantidade / %"]],
             body: [
                 ["Total de Agendamentos", totalVisitas],
                 ["Visitas Efetivadas (Sucesso)", ef.length],
                 ["Visitas Frustradas (Canceladas/Falta)", fr.length],
                 ["Visitas Pendentes", pe.length],
                 ["Taxa de Conversão Geral Sobre os Efetivados", `${taxaConversao}%`]
             ],
             headStyles: { fillColor: [30, 41, 59] },
             columnStyles: { 1: { halign: 'center', fontStyle: 'bold' } }
        });

        // ===============================================
        // SEPARAÇÃO DA BASE DE SUCESSO E FRUSTRAÇÃO
        // ===============================================
        const efVendas = ef.filter(v => v.tipo === 'Venda');
        const efLocacao = ef.filter(v => v.tipo !== 'Venda');

        const frVendas = fr.filter(v => v.tipo === 'Venda');
        const frLocacao = fr.filter(v => v.tipo !== 'Venda');

        // Valores de Sucesso
        const vgvVendas = efVendas.reduce((a, b) => a + (b.valor || 0), 0);
        const vglLocacao = efLocacao.reduce((a, b) => a + (b.valor || 0), 0);
        
        // Valores de Perda
        const vFrVendas = frVendas.reduce((a, b) => a + (b.valor || 0), 0);
        const vFrLocacao = frLocacao.reduce((a, b) => a + (b.valor || 0), 0);
        
        // Cálculo das Comissões Exatas
        const comissaoVendasAplicada = (vgvVendas >= configGeral.venda.meta) ? configGeral.venda.superComissao : configGeral.venda.comissao;
        const comissaoLocacaoAplicada = (vglLocacao >= configGeral.locacao.meta) ? configGeral.locacao.superComissao : configGeral.locacao.comissao;
        
        const comissaoEstimadaVendas = vgvVendas * (comissaoVendasAplicada / 100);
        const comissaoEstimadaLocacao = vglLocacao * (comissaoLocacaoAplicada / 100);
        const comissaoEstimadaGlobal = comissaoEstimadaVendas + comissaoEstimadaLocacao;

        let startY2 = doc.lastAutoTable.finalY + 10;
        
        // ===============================================
        // NOVA TABELA FINANCEIRA DETALHADA
        // ===============================================
        doc.autoTable({
            startY: startY2,
            head: [["2. Desempenho Financeiro", "Valor Movimentado"]],
            body: [
                ["VGL Efetivado (Locação)", formatarMoeda(vglLocacao)], // Índice 0
                ["Perda Estimada: Visitas Frustradas (Locação)", formatarMoeda(vFrLocacao)], // Índice 1
                [`Comissão de Locação Estimada (Total)`, formatarMoeda(comissaoEstimadaGlobal)] // Índice 2
            ],
            headStyles: { fillColor: [22, 163, 74] },
            columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
            didParseCell: function(data) {
                if (data.section === 'body') {
                    // Pinta a linha de perda de vermelho (agora é o índice 1)
                    if (data.row.index === 1) { 
                        data.cell.styles.textColor = [220, 38, 38]; 
                    }
                    // Destaca a Comissão Global com um fundo esverdeado (agora é o índice 2)
                    if (data.row.index === 2) {
                        data.cell.styles.fillColor = [240, 253, 244]; 
                        data.cell.styles.textColor = [22, 163, 74];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

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
             headStyles: { fillColor: [71, 85, 105] }, 
             columnStyles: { 1: { halign: 'center', fontStyle: 'bold' } }
        });
    }
    
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

// Função para garantir que o e-mail do usuário exista na base de dados
function garantirEmailNoBanco(user) {
    if (!user.email) return; // Se não tiver e-mail, não faz nada

    const perfilRef = window.dbRef(window.db, `usuarios/${user.uid}/perfil`);
    
    // Atualiza apenas o e-mail, sem apagar o que já lá estiver (como o nome profissional)
    window.dbUpdate(perfilRef, {
        email: user.email
    }).then(() => {
        console.log("E-mail sincronizado com sucesso no banco de dados.");
    }).catch((erro) => {
        console.error("Erro ao sincronizar e-mail:", erro);
    });
}

function mostrarAvisoModoSuporte(nome) {
    let banner = document.getElementById('banner-suporte');
    if(!banner) {
        banner = document.createElement('div');
        banner.id = 'banner-suporte';
        // Estilo para o banner flutuante no topo
        banner.style = "position: fixed; top: 0; left: 260px; right: 0; background: #eab308; color: #713f12; padding: 10px; text-align: center; font-weight: bold; z-index: 9999; display: flex; justify-content: center; align-items: center; gap: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);";
        document.body.appendChild(banner);
    }
    banner.innerHTML = `
        <span><i class="fa-solid fa-eye"></i> A visualizar como: ${nome}</span>
        <button onclick="sairModoSuporte()" style="background: #713f12; color: white; border: none; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Sair da Visualização</button>
    `;
}

window.sairModoSuporte = function() {
    sessionStorage.removeItem('admin_view_as_uid');
    sessionStorage.removeItem('admin_view_as_name');
    // NOVO: Em vez de reload, redireciona para o painel admin
    window.location.href = 'admin_master.html';
};

window.voltarPaginaAnterior = function() {
    const abaAnterior = localStorage.getItem('locagenda_active_tab') || 'dashboard';
    switchTab(abaAnterior);
};

// ==========================================
// AVISO DE META BLOQUEADA (EQUIPA)
// ==========================================
function mostrarAvisoMetaEquipa() {
    ['panel-locacao', 'panel-venda'].forEach(panelId => {
        const panel = document.getElementById(panelId);
        // Verifica se o aviso já existe para não duplicar
        if (panel && !panel.querySelector('.aviso-meta-equipa')) {
            const aviso = document.createElement('div');
            aviso.className = 'aviso-meta-equipa';
            aviso.style = "background: #eff6ff; color: #1e40af; padding: 12px 16px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 20px; border-left: 4px solid #3b82f6; display: flex; align-items: center; gap: 12px;";
            
            aviso.innerHTML = `
                <i class='fa-solid fa-lock' style='font-size: 1.2rem;'></i> 
                <div><b>Meta Bloqueada:</b> Como pertence a uma Imobiliária, este valor é definido pelo seu Gestor.</div>
            `;
            
            // Insere o aviso logo abaixo do título (h3) da secção
            const titulo = panel.querySelector('h3');
            if (titulo) titulo.parentNode.insertBefore(aviso, titulo.nextSibling);
        }
    });
}

// Nova função para manter a agenda pública sempre em dia com a privada
async function sincronizarAgendaPublica() {
    if (!usuarioLogadoUid) return;
    
    const espelhoRef = window.dbRef(window.db, `agenda_publica/${usuarioLogadoUid}`);
    const dadosPublicos = {};
    
    lembretesLocais.forEach(v => {
        // Só enviamos para o espelho público o que NÃO for frustrado ou oculto
        if (!v.ocultoCorretor && v.horario && v.resultado !== 'Frustrado') {
            // Salvamos apenas o horário, protegendo o nome e dados do cliente
            dadosPublicos[v.id] = { horario: v.horario };
        }
    });
    
    await window.dbSet(espelhoRef, dadosPublicos);
}