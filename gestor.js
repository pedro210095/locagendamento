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

// ==========================================
// ESTADO GLOBAL DO GESTOR
// ==========================================
let gestorImobiliariaId = null;
let nomeDaImobiliaria = "";
let equipaMembros = []; // Info básica dos corretores (nome, uid, acesso)
let agendamentosEquipa = []; // TODOS os agendamentos da equipa juntos

let contextoAtual = 'Locação';
let mesCalendario = new Date().getMonth();
let anoCalendario = new Date().getFullYear();
let diaSelecionado = null;

let chartTopInstancia = null;
let chartBairrosInstancia = null;
let fpInicio, fpFim, fpExpInicio, fpExpFim;

// ==========================================
// AUTENTICAÇÃO E INICIALIZAÇÃO
// ==========================================
let minhasImobiliarias = []; // Variável global nova para guardar as empresas do gestor

function iniciarPainelGestor() {
    if (!window.onAuthStateChanged || !window.auth) {
        setTimeout(iniciarPainelGestor, 500);
        return;
    }

    window.onAuthStateChanged(window.auth, async (user) => {
        if (user) {
            try {
                const pSnap = await window.dbGet(window.dbRef(window.db, `usuarios/${user.uid}/perfil`));
                if (pSnap.exists()) {
                    const perfil = pSnap.val();
                    
                    let listaIds = [];
                    if (perfil.listaImobiliarias) {
                        listaIds = Object.keys(perfil.listaImobiliarias);
                    } else if (perfil.imobiliariaId) {
                        listaIds = [perfil.imobiliariaId];
                    }

                    if (perfil.nivelAcesso === 'gestor' && listaIds.length > 0) {
                        const select = document.getElementById('select-imobiliaria-ativa');
                        select.innerHTML = '';
                        minhasImobiliarias = []; // Reseta a lista
                        
                        for (let id of listaIds) {
                            const imobSnap = await window.dbGet(window.dbRef(window.db, `imobiliarias/${id}`));
                            if (imobSnap.exists()) {
                                const data = imobSnap.val();
                                minhasImobiliarias.push(data);
                                select.innerHTML += `<option value="${id}">${data.nome}</option>`;
                            }
                        }

                        if (minhasImobiliarias.length > 0) {
                            // Carrega a primeira imobiliária da lista por defeito
                            gestorImobiliariaId = minhasImobiliarias[0].id;
                            configurarInterfaceImobiliaria(gestorImobiliariaId);
                            
                            document.getElementById('loading-global').style.display = 'none';
                            document.getElementById('app-container-main').style.display = 'flex';
                            iniciarFiltros();
                        } else {
                            alert("Não foram encontrados dados da sua Imobiliária.");
                            window.location.href = "index.html";
                        }
                    } else {
                        alert("Acesso Negado: Apenas gestores vinculados a uma Imobiliária podem aceder a este painel.");
                        window.location.href = "index.html";
                    }
                }
            } catch (error) {
                console.error("Erro na validação:", error);
                window.location.href = "index.html";
            }
        } else {
            window.location.href = "index.html";
        }
    });
}

function configurarInterfaceImobiliaria(id) {
    const imob = minhasImobiliarias.find(i => i.id === id);
    if (imob) {
        nomeDaImobiliaria = imob.nome;
        document.getElementById('nome-imobiliaria-sidebar').innerText = nomeDaImobiliaria;
        
        // Atualiza o título na Dashboard
        const headerNome = document.getElementById('nome-imob-header');
        if (headerNome) headerNome.innerText = nomeDaImobiliaria;
        
        // Limpa os campos antes de carregar
        document.getElementById('gestor-meta-locacao').value = '';
        document.getElementById('gestor-comissao-locacao').value = '';
        document.getElementById('gestor-super-locacao').value = '';
        document.getElementById('gestor-meta-venda').value = '';
        document.getElementById('gestor-comissao-venda').value = '';
        document.getElementById('gestor-super-venda').value = '';

        if (imob.metas) {
            document.getElementById('gestor-meta-locacao').value = imob.metas.locacao?.meta || '';
            document.getElementById('gestor-comissao-locacao').value = imob.metas.locacao?.comissao || '';
            document.getElementById('gestor-super-locacao').value = imob.metas.locacao?.superComissao || '';
            document.getElementById('gestor-meta-venda').value = imob.metas.venda?.meta || '';
            document.getElementById('gestor-comissao-venda').value = imob.metas.venda?.comissao || '';
            document.getElementById('gestor-super-venda').value = imob.metas.venda?.superComissao || '';
        }
        
        equipaMembros = [];
        agendamentosEquipa = [];
        carregarDadosDaEquipa();
    }
}

window.trocarContextoImobiliaria = function(idSelecionado) {
    gestorImobiliariaId = idSelecionado;
    configurarInterfaceImobiliaria(idSelecionado);
};

function iniciarFiltros() {
    const dashCfg = { dateFormat: "Y-m-d", altInput: true, altFormat: "d/m/Y", locale: "pt", onChange: () => atualizarPaineis() };
    fpInicio = flatpickr("#dash-data-inicio", dashCfg);
    fpFim = flatpickr("#dash-data-fim", dashCfg);
    
    fpExpInicio = flatpickr("#export-inicio", { dateFormat: "Y-m-d", altInput: true, altFormat: "d/m/Y", locale: "pt" });
    fpExpFim = flatpickr("#export-fim", { dateFormat: "Y-m-d", altInput: true, altFormat: "d/m/Y", locale: "pt" });
    
    window.limparFiltros();
}

window.limparFiltros = function() {
    const hj = new Date();
    let start, end;
    if (hj.getDate() >= 26) { 
        start = new Date(hj.getFullYear(), hj.getMonth(), 26); 
        end = new Date(hj.getFullYear(), hj.getMonth()+1, 25); 
    } else { 
        start = new Date(hj.getFullYear(), hj.getMonth()-1, 26); 
        end = new Date(hj.getFullYear(), hj.getMonth(), 25); 
    }
    if(fpInicio) fpInicio.setDate(start);
    if(fpFim) fpFim.setDate(end);
    if(fpExpInicio) fpExpInicio.setDate(start);
    if(fpExpFim) fpExpFim.setDate(end);
    
    atualizarPaineis();
};

window.mudarContexto = function(ctx) {
    contextoAtual = ctx;
    document.querySelectorAll('.dash-toggle-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(ctx === 'Locação' ? 'toggle-locacao' : 'toggle-venda').classList.add('active');
    document.getElementById('titulo-volume').innerText = ctx === 'Locação' ? 'Volume Gerado (VGL)' : 'Volume Gerado (VGV)';
    atualizarPaineis();
};

window.switchTab = function(tabNome) {
    document.querySelectorAll('.tab-section, .nav-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabNome}`).classList.add('active');
    document.getElementById(`btn-tab-${tabNome}`).classList.add('active');
    
    if(tabNome === 'calendario') renderCalendarioGlobal();
};

window.switchConfigTabGestor = function(tabNome) {
    // Tira a classe 'active' de todas as mini-tabs e painéis dentro das configurações do gestor
    document.querySelectorAll('#tab-config .mini-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('#tab-config .config-panel').forEach(el => el.classList.remove('active'));
    
    // Adiciona a classe 'active' apenas à aba que foi clicada
    document.getElementById(`tab-btn-gestor-${tabNome}`).classList.add('active');
    document.getElementById(`panel-gestor-${tabNome}`).classList.add('active');
};

window.fazerLogout = function() { window.logout(); };

document.addEventListener('DOMContentLoaded', iniciarPainelGestor);

// ==========================================
// CARREGAMENTO DE DADOS (A MÁGICA DA EQUIPA)
// ==========================================
function carregarDadosDaEquipa() {
    const usuariosRef = window.dbRef(window.db, 'usuarios');
    
    // Consulta segura que respeita as novas regras do Firebase
    const consultaEquipa = window.dbQuery(
        usuariosRef, 
        window.dbOrderByChild('perfil/imobiliariaId'), 
        window.dbEqualTo(gestorImobiliariaId)
    );

    window.dbOnValue(consultaEquipa, (snap) => {
        if(!snap.exists()) {
            equipaMembros = [];
            agendamentosEquipa = [];
            atualizarPaineis();
            return;
        }
        
        const usuarios = snap.val();
        equipaMembros = [];
        agendamentosEquipa = [];
        
        // Cores fixas para usar nas bolinhas do calendário
        const cores = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
        let corIndex = 0;

        Object.keys(usuarios).forEach(uid => {
            const u = usuarios[uid];
            if (u.perfil && u.perfil.imobiliariaId === gestorImobiliariaId) {
                const nomeCorretor = u.perfil.configGeral?.perfil?.nomeProfissional || u.perfil.nomeProfissional || "Corretor";
                const corAtribuida = cores[corIndex % cores.length];
                corIndex++;

                equipaMembros.push({
                    uid: uid,
                    nome: nomeCorretor,
                    ultimoAcesso: u.perfil.ultimoAcesso,
                    cor: corAtribuida,
                    inicial: nomeCorretor.charAt(0).toUpperCase()
                });

                if (u.agendamentos) {
                    const listaAg = Object.values(u.agendamentos);
                    listaAg.forEach(ag => {
                        // Injeta os dados do corretor no agendamento
                        agendamentosEquipa.push({
                            ...ag,
                            corretorUid: uid,
                            corretorNome: nomeCorretor,
                            corretorCor: corAtribuida,
                            corretorInicial: nomeCorretor.charAt(0).toUpperCase()
                        });
                    });
                }
            }
        });

        atualizarPaineis();
        renderCalendarioGlobal();
    });
}

// Filtra a lista mestre baseada nas datas e contexto (Locação/Venda)
function getAgendamentosFiltrados() {
    const dataIni = document.getElementById('dash-data-inicio').value;
    const dataFim = document.getElementById('dash-data-fim').value;

    return agendamentosEquipa.filter(ag => {
        const tipoReal = ag.tipo || 'Locação';
        if (tipoReal !== contextoAtual) return false;
        
        if (!ag.horario) return false;
        const dataPura = ag.horario.split('T')[0];
        
        return (!dataIni || dataPura >= dataIni) && (!dataFim || dataPura <= dataFim);
    });
}

function atualizarPaineis() {
    renderDashboardCards();
    renderGraficos();
    renderTabelaAcompanhamento();
}

// ==========================================
// ABA 1: DASHBOARD E GRÁFICOS
// ==========================================
function renderDashboardCards() {
    const filtrados = getAgendamentosFiltrados();
    
    const efetivados = filtrados.filter(a => a.resultado === 'Efetivado');
    const frustrados = filtrados.filter(a => a.resultado === 'Frustrado');
    const pendentes = filtrados.filter(a => !a.resultado); // <-- Captura as visitas pendentes
    
    const totalFechados = efetivados.length + frustrados.length;
    let conversao = 0;
    if (totalFechados > 0) conversao = (efetivados.length / totalFechados) * 100;
    
    const volume = efetivados.reduce((acc, curr) => acc + (curr.valor || 0), 0);
    const volumePendente = pendentes.reduce((acc, curr) => acc + (curr.valor || 0), 0); // <-- Soma os valores pendentes
    
    const formatoBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    if(document.getElementById('card-total-visitas')) document.getElementById('card-total-visitas').innerText = filtrados.length;
    if(document.getElementById('card-conversao')) document.getElementById('card-conversao').innerText = `${conversao.toFixed(1)}%`;
    if(document.getElementById('card-volume')) document.getElementById('card-volume').innerText = formatoBR.format(volume);
    
    // Atualiza o novo card
    if(document.getElementById('card-volume-pendente')) document.getElementById('card-volume-pendente').innerText = formatoBR.format(volumePendente); 
}

function renderGraficos() {
    const filtrados = getAgendamentosFiltrados();

    // === NOVOS GRÁFICOS REDONDOS (CHAVES E ACOMPANHAMENTO) ===
    const efetivados = filtrados.filter(a => a.resultado === 'Efetivado');
    let locabens = 0, redentora = 0;
    let acompanhou = 0, sozinho = 0;

    // Conta apenas os dados das visitas que foram um sucesso
    efetivados.forEach(v => {
        if (v.chave === 'Locabens') locabens++;
        if (v.chave === 'Redentora') redentora++;
        if (v.acompanhamento === 'Acompanhar') acompanhou++;
        if (v.acompanhamento === 'Não Acompanhar') sozinho++;
    });

    // Gráfico de Chaves (Apenas Efetivados)
    const ctxChaves = document.getElementById('chartChavesEquipa');
    if (ctxChaves) {
        if (window.chartChavesInstanciaEquipa) window.chartChavesInstanciaEquipa.destroy();
        window.chartChavesInstanciaEquipa = new Chart(ctxChaves, {
            type: 'doughnut',
            data: {
                labels: ['Locabens', 'Redentora'],
                datasets: [{ data: [locabens, redentora], backgroundColor: ['#3b82f6', '#a855f7'], borderWidth: 0 }]
            },
            options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }
        });
    }

    // Gráfico de Acompanhamento (Apenas Efetivados)
    const ctxAcomp = document.getElementById('chartAcompanhamentoEquipa');
    if (ctxAcomp) {
        if (window.chartAcompInstanciaEquipa) window.chartAcompInstanciaEquipa.destroy();
        window.chartAcompInstanciaEquipa = new Chart(ctxAcomp, {
            type: 'doughnut',
            data: {
                labels: ['Acompanhado', 'Sozinho'],
                datasets: [{ data: [acompanhou, sozinho], backgroundColor: ['#10b981', '#f59e0b'], borderWidth: 0 }]
            },
            options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } } }
        });
    }
    
    // === NOVO: RANKING ESTILIZADO EM LISTA (LEADERBOARD) ===
    const contagemRanking = [];

    // 1. Calcula os dados de performance de cada membro da equipa
    equipaMembros.forEach(membro => {
        const agMembro = filtrados.filter(ag => ag.corretorUid === membro.uid);
        const efetivados = agMembro.filter(a => a.resultado === 'Efetivado').length;
        const frustrados = agMembro.filter(a => a.resultado === 'Frustrado').length;
        const totalFinalizados = efetivados + frustrados;

        let taxaConversao = 0;
        if (totalFinalizados > 0) taxaConversao = Math.round((efetivados / totalFinalizados) * 100);

        contagemRanking.push({
            ...membro,
            efetivados: efetivados,
            conversao: taxaConversao,
            totalVisitas: agMembro.length
        });
    });

    // 2. Ordena o Ranking: Mais efetivados no topo
    contagemRanking.sort((a, b) => {
        if (b.efetivados !== a.efetivados) return b.efetivados - a.efetivados;
        return b.conversao - a.conversao;
    });

    // 3. Renderiza a lista estilizada no novo container
    const container = document.getElementById('ranking-corretores-container');
    if (container) {
        container.innerHTML = '';
        const maxEfetivados = contagemRanking.length > 0 ? contagemRanking[0].efetivados : 1; 

        contagemRanking.forEach((corretor, index) => {
            const percentualBarra = maxEfetivados > 0 ? (corretor.efetivados / maxEfetivados) * 100 : 0;

            // Cores dinâmicas para o termómetro de efetividade
            let corBadge = '#64748b', bgBadge = '#f1f5f9', borderBadge = '#e2e8f0';
            if (corretor.efetivados > 0 || corretor.totalVisitas > 0) {
                if (corretor.conversao >= 70) { corBadge = '#16a34a'; bgBadge = '#dcfce3'; borderBadge = '#bbf7d0'; }
                else if (corretor.conversao >= 40) { corBadge = '#ca8a04'; bgBadge = '#fefce8'; borderBadge = '#fef08a'; }
                else { corBadge = '#dc2626'; bgBadge = '#fef2f2'; borderBadge = '#fecaca'; }
            }

            const posicao = index + 1;
            let iconePosicao = `<span style="font-weight: bold; color: #94a3b8; width: 24px; text-align: center;">${posicao}º</span>`;
            if (posicao === 1 && corretor.efetivados > 0) iconePosicao = '<i class="fa-solid fa-trophy" style="color: #eab308; width: 24px; text-align: center; font-size: 1.1rem;"></i>';
            else if (posicao === 2 && corretor.efetivados > 0) iconePosicao = '<i class="fa-solid fa-medal" style="color: #94a3b8; width: 24px; text-align: center; font-size: 1.1rem;"></i>';
            else if (posicao === 3 && corretor.efetivados > 0) iconePosicao = '<i class="fa-solid fa-medal" style="color: #b45309; width: 24px; text-align: center; font-size: 1.1rem;"></i>';

            container.innerHTML += `
                <div style="position: relative; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; overflow: hidden; display: flex; justify-content: space-between; align-items: center; z-index: 1; margin-bottom: 8px;">
                    <div style="position: absolute; left: 0; top: 0; height: 100%; width: ${percentualBarra}%; background: linear-gradient(to right, rgba(14, 165, 233, 0.05), rgba(14, 165, 233, 0.15)); z-index: -1; transition: width 0.5s ease-out;"></div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${iconePosicao}
                        <div style="width: 38px; height: 38px; border-radius: 50%; background: ${corretor.cor}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1rem; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            ${corretor.inicial}
                        </div>
                        <div>
                            <div style="font-weight: 600; color: #1e293b; font-size: 0.95rem;">${corretor.nome}</div>
                            <div style="font-size: 0.75rem; color: #64748b;">${corretor.totalVisitas} visitas na agenda</div>
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; align-items: center; gap: 16px;">
                        <div style="text-align: center;">
                            <div style="font-weight: 800; color: #0ea5e9; font-size: 1.2rem; line-height: 1;">${corretor.efetivados}</div>
                            <div style="font-size: 0.65rem; color: #64748b; text-transform: uppercase; margin-top: 2px;">Efetivados</div>
                        </div>
                        <div style="background: ${bgBadge}; color: ${corBadge}; padding: 6px 10px; border-radius: 8px; font-weight: 700; font-size: 0.85rem; border: 1px solid ${borderBadge}; min-width: 60px; text-align: center;">
                            ${corretor.conversao}%
                        </div>
                    </div>
                </div>`;
        });
    }

    // 2. Processamento Mapa de Bairros (Efetivados vs Frustrados)
// === IMPLEMENTAÇÃO DO TERMÓMETRO DE TERRITÓRIO (BAIRROS) ===
    const bairrosData = {};

    // 1. Agrupa as visitas finalizadas por bairro
    filtrados.forEach(ag => {
        if (ag.resultado === 'Efetivado' || ag.resultado === 'Frustrado') {
            const bairro = (ag.bairro || 'Não Informado').trim();
            if (!bairrosData[bairro]) {
                bairrosData[bairro] = { nome: bairro, efetivados: 0, frustrados: 0, total: 0 };
            }
            bairrosData[bairro].total++;
            if (ag.resultado === 'Efetivado') bairrosData[bairro].efetivados++;
            if (ag.resultado === 'Frustrado') bairrosData[bairro].frustrados++;
        }
    });

    // 2. Ordena os bairros com mais visitas totais para o topo (Top 10)
    const bairrosOrdenados = Object.values(bairrosData)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

    // 3. Renderiza a lista no HTML
    const containerBairros = document.getElementById('ranking-bairros-container');
    if (containerBairros) {
        containerBairros.innerHTML = '';
        
        // === NOVA CONFIGURAÇÃO DE COLUNAS ===
        containerBairros.style.display = 'grid';
        containerBairros.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
        containerBairros.style.gap = '12px'; 
        containerBairros.style.alignItems = 'start';
        // =====================================
        
        if (bairrosOrdenados.length === 0) {
            containerBairros.innerHTML = '<p style="color: #64748b; font-size: 0.9rem; text-align: center; margin-top: 20px;">Sem visitas finalizadas no período.</p>';
        } else {
            bairrosOrdenados.forEach(b => {
                // Calcula a percentagem para desenhar a barra bicolor
                const percEfetivados = Math.round((b.efetivados / b.total) * 100);
                const percFrustrados = Math.round((b.frustrados / b.total) * 100);
                
                containerBairros.innerHTML += `
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 32px; height: 32px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; color: #64748b;">
                                    <i class="fa-solid fa-map-location-dot"></i>
                                </div>
                                <span style="font-weight: 600; color: #1e293b; font-size: 0.95rem;">${b.nome}</span>
                            </div>
                            <div style="text-align: right;">
                                <span style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">${b.total}</span>
                                <span style="font-size: 0.65rem; color: #64748b; text-transform: uppercase; display: block; margin-top: -2px;">Visitas</span>
                            </div>
                        </div>
                        
                        <div style="width: 100%; height: 8px; border-radius: 4px; display: flex; overflow: hidden; background: #f1f5f9; margin-bottom: 8px;">
                            <div style="width: ${percEfetivados}%; background: #10b981;" title="Sucesso: ${percEfetivados}%"></div>
                            <div style="width: ${percFrustrados}%; background: #ef4444;" title="Perda: ${percFrustrados}%"></div>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
                            <span style="color: #16a34a; font-weight: 600;"><i class="fa-solid fa-check"></i> ${b.efetivados} Sucesso (${percEfetivados}%)</span>
                            <span style="color: #dc2626; font-weight: 600;"><i class="fa-solid fa-xmark"></i> ${b.frustrados} Perda (${percFrustrados}%)</span>
                        </div>
                    </div>
                `;
            });
        }
    }
}
// ==========================================
// ABA 2: ACOMPANHAMENTO DE CORRETORES
// ==========================================
function renderTabelaAcompanhamento() {
    const tbody = document.getElementById('tabela-equipa-corpo');
    tbody.innerHTML = '';
    const filtrados = getAgendamentosFiltrados();
    const formatoBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const tempoAgora = new Date(); // Usado para calcular a próxima visita

    equipaMembros.forEach(membro => {
        const agMembro = filtrados.filter(ag => ag.corretorUid === membro.uid);
        
        const pendentes = agMembro.filter(a => !a.resultado).length;
        const efetivados = agMembro.filter(a => a.resultado === 'Efetivado');
        const frustrados = agMembro.filter(a => a.resultado === 'Frustrado').length;
        
        const valorTotal = efetivados.reduce((acc, curr) => acc + (curr.valor || 0), 0);
        
        // --- LÓGICA DA PRÓXIMA VISITA ---
        // Pega todas as visitas futuras e pendentes deste corretor
        const proximas = agMembro
            .filter(a => !a.resultado && a.horario && new Date(a.horario) >= tempoAgora)
            .sort((a, b) => new Date(a.horario) - new Date(b.horario));
        
        let textoProximaVisita = '<span style="color: #94a3b8; font-style: italic;">Livre / Sem agenda</span>';
        
        if (proximas.length > 0) {
            const prox = proximas[0];
            const dataProx = new Date(prox.horario);
            
            // Verifica se a visita é hoje para dar um destaque visual
            const isHoje = dataProx.toDateString() === tempoAgora.toDateString();
            const dataFormatada = isHoje ? 'Hoje' : dataProx.toLocaleDateString('pt-PT', {day: '2-digit', month: '2-digit'});
            const horaFormatada = dataProx.toLocaleTimeString('pt-PT', {hour: '2-digit', minute:'2-digit'});
            
            // Monta o visual: Hora em azul e o nome do cliente menorzinho embaixo
            textoProximaVisita = `<span style="color: #0ea5e9; font-weight: 600;"><i class="fa-regular fa-clock"></i> ${dataFormatada} às ${horaFormatada}</span><br><small style="color: #64748b; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; max-width: 140px;">${prox.nome}</small>`;
        }
        // ---------------------------------

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${membro.nome}</b></td>
            <td style="text-align: center;"><span class="badge" style="background:#fef08a; color:#854d0e">${pendentes}</span></td>
            <td style="text-align: center;"><span class="badge badge-success">${efetivados.length}</span></td>
            <td style="text-align: center;"><span class="badge badge-danger">${frustrados}</span></td>
            <td><b>${formatoBR.format(valorTotal)}</b></td>
            <td>${textoProximaVisita}</td>
            <td style="text-align: right;">
                <button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;" onclick="abrirModalDetalhes('${membro.uid}', '${membro.nome}')">
                    <i class="fa-solid fa-list"></i> Ver Detalhes
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.abrirModalDetalhes = function(uid, nome) {
    document.getElementById('span-nome-corretor').innerText = `Visitas de ${nome}`;
    const tbody = document.getElementById('tabela-detalhes-corpo');
    tbody.innerHTML = '';
    
    // Pega as visitas apenas desse corretor no contexto e datas atuais
    const visitas = getAgendamentosFiltrados().filter(a => a.corretorUid === uid).sort((a,b) => new Date(b.horario) - new Date(a.horario));
    
    if(visitas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum registo neste período.</td></tr>';
    } else {
        const formatoBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
        visitas.forEach(v => {
            const status = v.resultado === 'Efetivado' ? `<span class="badge badge-success">Efetivado</span>` : (v.resultado === 'Frustrado' ? `<span class="badge badge-danger">Frustrado</span>` : `<span class="badge badge-pending">Pendente</span>`);
            const dt = new Date(v.horario).toLocaleString('pt-PT', {dateStyle:'short', timeStyle:'short'});
            
            // Substitua as variáveis obsHtml e feedbackHtml:
            const observacao = v.texto ? window.sanitizarTexto(v.texto) : 'Sem detalhes informados';
            const obsHtml = `<span style="color: #64748b; font-size: 0.8rem; display: block; margin-top: 4px; line-height: 1.3;">${observacao}</span>`;

            let feedbackHtml = '';
            if (v.feedbackCorretor) {
                feedbackHtml = `<span style="font-size: 0.85rem; display: block; margin-top: 4px;">
                    <span style="color: #db233b; font-weight: 500;"><i class="fa-solid fa-reply"></i> Motivo da Frustração:</span> 
                    <span style="color: #e99c0e; font-weight: 700;">${window.sanitizarTexto(v.feedbackCorretor)}</span>
                </span>`;
            }
            
            // Substitua o tbody.innerHTML += ... por:
            tbody.innerHTML += `<tr>
                <td style="padding-top: 12px; padding-bottom: 12px;"><b>${window.sanitizarTexto(v.nome)}</b>${obsHtml}${feedbackHtml}</td>
                <td style="padding-top: 12px; padding-bottom: 12px;">${dt}</td>
                <td style="padding-top: 12px; padding-bottom: 12px;">${formatBRL(v.valor||0)}</td>
                <td style="padding-top: 12px; padding-bottom: 12px;">${status}</td>
            </tr>`;
        });
    }
    
    document.getElementById('modal-detalhes-corretor').classList.add('show');
};

window.fecharModalDetalhes = () => document.getElementById('modal-detalhes-corretor').classList.remove('show');

// ==========================================
// ABA 3: CALENDÁRIO GLOBAL
// ==========================================
window.mudarMes = function(dir) {
    mesCalendario += dir;
    if (mesCalendario < 0) { mesCalendario = 11; anoCalendario--; } 
    else if (mesCalendario > 11) { mesCalendario = 0; anoCalendario++; }
    renderCalendarioGlobal();
};

function renderCalendarioGlobal() {
    const grid = document.getElementById('calendar-grid-global');
    if(!grid) return;
    grid.innerHTML = '';
    
    const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    document.getElementById('mes-ano-display').innerText = `${mesesNomes[mesCalendario]} ${anoCalendario}`;
    
    const primDia = new Date(anoCalendario, mesCalendario, 1);
    const ultDia = new Date(anoCalendario, mesCalendario + 1, 0);
    
    for(let i = 0; i < primDia.getDay(); i++) {
        const div = document.createElement('div');
        div.className = 'calendar-day empty';
        grid.appendChild(div);
    }
    
    let dAtual = new Date(primDia);
    while (dAtual <= ultDia) {
        const strData = `${dAtual.getFullYear()}-${String(dAtual.getMonth()+1).padStart(2,'0')}-${String(dAtual.getDate()).padStart(2,'0')}`;
        
        // Pega todos os agendamentos da equipa nesse dia (Independente do filtro de contexto)
        const visitasDia = agendamentosEquipa.filter(ag => ag.horario && ag.horario.startsWith(strData));
        
        const celula = document.createElement('div');
        celula.className = 'calendar-day';
        if (strData === diaSelecionado) celula.classList.add('selected');
        
        let bolinhasHtml = '<div style="display:flex; flex-wrap:wrap; gap:2px; margin-top:4px;">';
        // Mostra no máximo 6 bolinhas para não estragar o layout, com as iniciais do corretor
        visitasDia.slice(0,6).forEach(v => {
            bolinhasHtml += `<div class="dot-gestor" style="background:${v.corretorCor}" title="${v.corretorNome}">${v.corretorInicial}</div>`;
        });
        if(visitasDia.length > 6) bolinhasHtml += `<div class="dot-gestor" style="background:#64748b">+</div>`;
        bolinhasHtml += '</div>';

        celula.innerHTML = `<span class="calendar-date-num">${dAtual.getDate()}</span>${visitasDia.length > 0 ? bolinhasHtml : ''}`;
        
        const dataClique = strData;
        celula.onclick = () => { diaSelecionado = dataClique; renderCalendarioGlobal(); mostrarAgendaDia(dataClique); };
        
        grid.appendChild(celula);
        dAtual.setDate(dAtual.getDate() + 1);
    }
}

function mostrarAgendaDia(strData) {
    document.getElementById('agenda-dia-container').style.display = 'block';
    
    // Formata a data de YYYY-MM-DD para DD/MM/YYYY manualmente
    const partes = strData.split('-');
    const dataDisplay = `${partes[2]}/${partes[1]}/${partes[0]}`;
    document.getElementById('titulo-dia-agenda').innerText = `Visitas de ${dataDisplay}`;
    
    const tbody = document.getElementById('tabela-dia-corpo');
    const visitas = agendamentosEquipa.filter(ag => ag.horario && ag.horario.startsWith(strData)).sort((a,b) => new Date(a.horario) - new Date(b.horario));
    
    if(visitas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhuma visita global neste dia.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    visitas.forEach(v => {
        const status = v.resultado === 'Efetivado' ? `<span class="badge badge-success">Efetivado</span>` : (v.resultado === 'Frustrado' ? `<span class="badge badge-danger">Frustrado</span>` : `<span class="badge badge-pending">Pendente</span>`);
        const hr = new Date(v.horario).toLocaleTimeString('pt-PT', {hour:'2-digit', minute:'2-digit'});
        
        tbody.innerHTML += `
            <tr>
                <td><span style="border-left: 4px solid ${v.corretorCor}; padding-left: 8px; font-weight:bold;">${v.corretorNome}</span></td>
                <td>${v.nome}</td>
                <td>${hr}</td>
                <td>${status}</td>
            </tr>
        `;
    });
}
// ==========================================
// ABA 5: RELATÓRIOS INTELIGENTES (PDF)
// ==========================================

// Função auxiliar para capturar dados filtrados pela data de exportação
function getDadosExportacao() {
    const dataIni = document.getElementById('export-inicio').value;
    const dataFim = document.getElementById('export-fim').value;

    const filtrados = agendamentosEquipa.filter(ag => {
        if (!ag.horario || ag.ocultoCorretor) return false;
        const dataPura = ag.horario.split('T')[0];
        return (!dataIni || dataPura >= dataIni) && (!dataFim || dataPura <= dataFim);
    }).sort((a,b) => new Date(a.horario) - new Date(b.horario));
    
    if (filtrados.length === 0) alert("Nenhuma visita encontrada neste período.");
    return filtrados;
}

// Função auxiliar para cabeçalho padrão
function criarCabecalhoPDF(doc, tituloRelatorio) {
    const dataIni = document.getElementById('export-inicio').value;
    const dataFim = document.getElementById('export-fim').value;
    const dataFormatada = (d) => d ? d.split('-').reverse().join('/') : 'Sempre';

    doc.setFontSize(18);
    doc.setTextColor(3, 105, 161);
    doc.text(`RELATÓRIO: ${tituloRelatorio.toUpperCase()}`, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Imobiliária: ${nomeDaImobiliaria} | Período: ${dataFormatada(dataIni)} a ${dataFormatada(dataFim)}`, 14, 28);
    
    doc.setFontSize(8);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-PT')}`, 280, 20, { align: 'right' });
}

const formatBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

    // --- 1. RELATÓRIO: FECHO DE MÊS (LOCAÇÃO) ---
    window.gerarPDFFechoMes = function() {
        const dados = getDadosExportacao();
        if(dados.length === 0) return;

        const locacao = dados.filter(a => (a.tipo || 'Locação') === 'Locação');
        const metaIndividual = parseFloat(document.getElementById('gestor-meta-locacao').value) || 1;
        
        // --- NOVO: Cálculo do VGL Total da Equipa ---
        const totalVGLEquipa = locacao
            .filter(a => a.resultado === 'Efetivado')
            .reduce((acc, curr) => acc + (curr.valor || 0), 0);

        let contagemCorretores = {};
        locacao.forEach(ag => {
            if (!contagemCorretores[ag.corretorUid]) {
                contagemCorretores[ag.corretorUid] = { nome: ag.corretorNome, total: 0, efetivados: 0, vgl: 0 };
            }
            if (ag.resultado === 'Efetivado' || ag.resultado === 'Frustrado') contagemCorretores[ag.corretorUid].total++;
            if (ag.resultado === 'Efetivado') {
                contagemCorretores[ag.corretorUid].efetivados++;
                contagemCorretores[ag.corretorUid].vgl += (ag.valor || 0);
            }
        });

        let listaCompleta = Object.values(contagemCorretores).map(c => {
            c.conversao = c.total > 0 ? ((c.efetivados / c.total) * 100) : 0;
            c.atingimentoMeta = (c.vgl / metaIndividual) * 100;
            return c;
        }).sort((a, b) => b.conversao - a.conversao);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape');
        criarCabecalhoPDF(doc, "Fechamento de Mês (Performance de Locação)");

        // === NOVO: TABELA DE RESUMO DO TOTAL NO TOPO ===
        doc.autoTable({
            startY: 35,
            head: [["VGL Total Efetivado (Equipe)"]],
            body: [[formatBRL(totalVGLEquipa)]],
            headStyles: { fillColor: [16, 185, 129], halign: 'center' }, // Verde para sucesso
            styles: { halign: 'center', fontSize: 14, fontStyle: 'bold' },
            margin: { left: 100, right: 100 } // Centraliza a tabelinha de resumo
        });

        // Tabela de Performance da Equipa (continua abaixo da anterior)
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 15, // Dá um espaço após o total
            head: [["Posição", "Corretor", "Efetivados", "Taxa Conversão", "VGL Gerado", "Meta Individual", "% Atingida"]],
            body: listaCompleta.map((c, i) => [
                `${i + 1}º`, 
                c.nome, 
                c.efetivados, 
                `${c.conversao.toFixed(1)}%`, 
                formatBRL(c.vgl), 
                formatBRL(metaIndividual),
                `${c.atingimentoMeta.toFixed(1)}%`
            ]),
            headStyles: { fillColor: [3, 105, 161] },
            columnStyles: {
                0: { halign: 'center', fontStyle: 'bold' },
                3: { fontStyle: 'bold' },
                4: { fontStyle: 'bold' },
                6: { fontStyle: 'bold', textColor: [16, 185, 129] }
            }
        });

        doc.save(`Fecho_Mes_Locacao_${nomeDaImobiliaria.replace(/\s/g, '_')}.pdf`);
    };

// --- 2. RELATÓRIO: RAIO-X DA EQUIPA ---
window.gerarPDFRaioXEquipa = function() {
    const dados = getDadosExportacao();
    if(dados.length === 0) return;

    let stats = {};
    equipaMembros.forEach(m => {
        stats[m.uid] = { nome: m.nome, efetivados: 0, frustrados: 0, pendentes: 0, volumePendente: 0, acompSim: 0, acompNao: 0 };
    });

    let totalGeralPendentes = 0; 
    let totalGeralVolumePendente = 0; // <-- NOVA variável para somar o dinheiro de toda a equipa

    dados.forEach(ag => {
        if (!stats[ag.corretorUid]) return;
        const st = stats[ag.corretorUid];
        
        if (!ag.resultado) {
            st.pendentes++;
            st.volumePendente += (ag.valor || 0);
            
            // Soma para o total geral da imobiliária
            totalGeralPendentes++; 
            totalGeralVolumePendente += (ag.valor || 0); 
        } else if (ag.resultado === 'Efetivado') {
            st.efetivados++;
            if (ag.acompanhamento === 'Acompanhar') st.acompSim++;
            else st.acompNao++;
        } else if (ag.resultado === 'Frustrado') {
            st.frustrados++;
        }
    });

    const linhas = Object.values(stats).filter(s => (s.efetivados + s.frustrados + s.pendentes) > 0).map(s => {
        const finalizados = s.efetivados + s.frustrados;
        const conversao = finalizados > 0 ? ((s.efetivados / finalizados) * 100).toFixed(1) : "0.0";
        const totalAcomp = s.acompSim + s.acompNao;
        const taxaAcomp = totalAcomp > 0 ? ((s.acompSim / totalAcomp) * 100).toFixed(0) : "0";

        return [
            s.nome, 
            `${s.efetivados} / ${s.frustrados}`, 
            `${conversao}%`, 
            s.pendentes, 
            formatBRL(s.volumePendente), 
            `${taxaAcomp}% presencial`
        ];
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    criarCabecalhoPDF(doc, "Raio-X da Equipe (Performance Individual)");

    doc.autoTable({
        startY: 35,
        head: [["Corretor(a)", "Efetivados / Frustrados", "Conversão", "Qtd. Pendente", "Dinheiro Pendente", "Taxa de Sucessos"]],
        body: linhas,
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: { 4: { fontStyle: 'bold', textColor: [234, 179, 8] } } 
    });

    // === ATUALIZADO: TABELA DE RESUMO NO FINAL DO RELATÓRIO ===
    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 15, 
        head: [["TOTAL DE VISITAS PENDENTES", "VOLUME TOTAL PENDENTE"]],
        body: [[totalGeralPendentes, formatBRL(totalGeralVolumePendente)]],
        headStyles: { fillColor: [245, 158, 11], halign: 'center' }, // Laranja para alerta
        styles: { halign: 'center', fontSize: 13, fontStyle: 'bold' },
        margin: { left: 40, right: 40 } // Ajustado para a tabela ficar um pouco mais larga e caber os dois valores
    });

    doc.save(`RaioX_Equipa_${nomeDaImobiliaria.replace(/\s/g, '_')}.pdf`);
};

// --- 3. RELATÓRIO: MAPA DE PERDAS E GARGALOS ---
window.gerarPDFGargalos = function() {
    const dados = getDadosExportacao();
    if(dados.length === 0) return;

    // Ajuste: Filtramos apenas visitas de 'Locação' que foram 'Frustrado'
    const frustrados = dados.filter(a => a.resultado === 'Frustrado' && (a.tipo || 'Locação') === 'Locação');
    
    let chaves = {};
    let listaJustificativas = [];
    
    // VARIÁVEIS NOVAS: Para somar o total geral de perdas
    let totalQtdFrustradas = 0;
    let totalGeralValorPerdido = 0;

    frustrados.forEach(ag => {
        const local = ag.chave || 'Não Informado';
        if (!chaves[local]) chaves[local] = { nome: local, quantidade: 0, valorPerdido: 0 };
        
        chaves[local].quantidade++;
        chaves[local].valorPerdido += (ag.valor || 0);

        // Alimentando o somatório geral
        totalQtdFrustradas++;
        totalGeralValorPerdido += (ag.valor || 0);

        if (ag.feedbackCorretor && ag.feedbackCorretor.trim() !== '') {
            listaJustificativas.push([ag.nome, ag.corretorNome, local, ag.feedbackCorretor]);
        }
    });

    const linhasChaves = Object.values(chaves).sort((a,b) => b.quantidade - a.quantidade).map(c => [c.nome, c.quantidade, formatBRL(c.valorPerdido)]);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    criarCabecalhoPDF(doc, "Mapa de Perdas e Gargalos Logísticos");

    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text("Resumo de Perdas por Localização de Chave", 14, 38);

    doc.autoTable({
        startY: 43,
        head: [["Local da Chave", "Visitas Frustradas", "Valor Total Estimado Perdido (VGL)"]],
        body: linhasChaves.length > 0 ? linhasChaves : [["Nenhum gargalo identificado", "-", "-"]],
        // NOVO: Adiciona a linha de total no rodapé da tabela
        foot: linhasChaves.length > 0 ? [["TOTAL GERAL DA IMOBILIÁRIA", totalQtdFrustradas, formatBRL(totalGeralValorPerdido)]] : [],
        headStyles: { fillColor: [239, 68, 68] }, // Vermelho
        // NOVO: Estiliza o rodapé com um fundo vermelho claro para dar destaque
        footStyles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold' },
        columnStyles: { 2: { fontStyle: 'bold', textColor: [220, 38, 38] } }
    });

    doc.text("Justificativas Registadas pela Equipe", 14, doc.lastAutoTable.finalY + 15);

    doc.autoTable({
        startY: doc.lastAutoTable.finalY + 20,
        head: [["Cliente / Ref.", "Corretor", "Chave", "Motivo (Feedback)"]],
        body: listaJustificativas.length > 0 ? listaJustificativas : [["Sem justificativas detalhadas.", "", "", ""]],
        headStyles: { fillColor: [71, 85, 105] },
        styles: { cellWidth: 'wrap' },
        columnStyles: { 3: { cellWidth: 120 } }
    });

    doc.save(`Gargalos_${nomeDaImobiliaria.replace(/\s/g, '_')}.pdf`);
};

// --- 4. RELATÓRIO: PIPELINE DE OPORTUNIDADES ---
window.gerarPDFPipeline = function() {
    const dados = getDadosExportacao();
    if(dados.length === 0) return;

    // Filtra apenas pendentes e ordena pelo valor do mais alto para o mais baixo
    const pendentes = dados.filter(a => !a.resultado).sort((a, b) => (b.valor || 0) - (a.valor || 0));

    if(pendentes.length === 0) {
        alert("Não existem visitas Pendentes no período selecionado. A sua equipa está com tudo finalizado!");
        return;
    }

    const linhas = pendentes.map(ag => [
        ag.corretorNome,
        ag.nome,
        ag.bairro || 'Sem Bairro',
        formatBRL(ag.valor),
        new Date(ag.horario).toLocaleString('pt-PT', {dateStyle: 'short', timeStyle: 'short'})
    ]);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    criarCabecalhoPDF(doc, "Pipeline de Ataque (Visitas Pendentes)");

    doc.setFontSize(10);
    doc.setTextColor(245, 158, 11); // Laranja/Amarelo
    doc.text(`Total de oportunidades pendentes: ${pendentes.length}`, 14, 35);

    doc.autoTable({
        startY: 40,
        head: [["Corretor Responsável", "Cliente / Referência", "Bairro", "Valor", "Agendado para"]],
        body: linhas,
        headStyles: { fillColor: [245, 158, 11] }, // Laranja
        columnStyles: { 3: { fontStyle: 'bold', halign: 'right' }, 0: { fontStyle: 'bold' } },
        // Adicione este bloco abaixo para alinhar o cabeçalho:
        didParseCell: function(data) {
            if (data.section === 'head' && data.column.index === 3) {
                data.cell.styles.halign = 'right';
            }
        }
    });

    doc.save(`Pipeline_Ataque_${nomeDaImobiliaria.replace(/\s/g, '_')}.pdf`);
};

// ==========================================
// AUDITORIA E LIXEIRA (TRAVA DE SEGURANÇA)
// ==========================================
window.abrirModalLixeira = function() {
    const tbody = document.getElementById('tabela-lixeira-corpo');
    tbody.innerHTML = '';
    
    // Filtra TODAS as visitas da equipa que foram ocultadas pelo corretor (Soft Delete)
    const excluidas = agendamentosEquipa.filter(ag => ag.ocultoCorretor === true).sort((a,b) => (b.dataExclusao || 0) - (a.dataExclusao || 0));
    
    if(excluidas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Nenhuma visita na lixeira.</td></tr>';
    } else {
        excluidas.forEach(v => {
            const dtExclusao = v.dataExclusao ? new Date(v.dataExclusao).toLocaleString('pt-PT', {dateStyle:'short', timeStyle:'short'}) : 'Desconhecida';
            
            tbody.innerHTML += `
                <tr>
                    <td><b>${v.corretorNome}</b></td>
                    <td>${v.nome}</td>
                    <td style="color: #dc2626; font-style: italic;"><i class="fa-solid fa-quote-left" style="color: #fca5a5;"></i> ${v.motivoExclusao || 'Sem motivo'}</td>
                    <td>${dtExclusao}</td>
                    <td style="text-align: right;">
                        <button class="btn btn-danger" style="padding: 4px 8px; font-size: 0.8rem; background: #dc2626; color: white; border: none; border-radius: 4px;" onclick="apagarDefinitivamente('${v.corretorUid}', ${v.id})" title="Apagar do Servidor">
                            <i class="fa-solid fa-fire"></i> Excluir
                        </button>
                    </td>
                </tr>
            `;
        });
    }
    document.getElementById('modal-lixeira-equipa').classList.add('show');
};

window.fecharModalLixeira = () => document.getElementById('modal-lixeira-equipa').classList.remove('show');

window.apagarDefinitivamente = async function(uidCorretor, idVisita) {
    if(confirm("Esta ação apagará a visita definitivamente da base de dados Firebase. Não poderá ser revertida. Continuar?")) {
        const refVisitas = window.dbRef(window.db, `usuarios/${uidCorretor}/agendamentos`);
        const snap = await window.dbGet(refVisitas);
        if (snap.exists()) {
            let lista = Object.values(snap.val());
            lista = lista.filter(v => v.id !== idVisita); // Remove a visita alvo
            
            await window.dbSet(refVisitas, lista);
            alert("Visita destruída permanentemente.");
            carregarDadosDaEquipa(); // Recarrega os dados globais para atualizar a memória
            abrirModalLixeira(); // Atualiza a tabela do modal
        }
    }
};

// ==========================================
// SALVAR METAS DA EQUIPE (NOVO)
// ==========================================
window.salvarMetasEquipa = function() {
    const dadosMetas = {
        locacao: {
            meta: parseFloat(document.getElementById('gestor-meta-locacao').value) || 0,
            comissao: parseFloat(document.getElementById('gestor-comissao-locacao').value) || 0,
            superComissao: parseFloat(document.getElementById('gestor-super-locacao').value) || 0
        },
        venda: {
            meta: parseFloat(document.getElementById('gestor-meta-venda').value) || 0,
            comissao: parseFloat(document.getElementById('gestor-comissao-venda').value) || 0,
            superComissao: parseFloat(document.getElementById('gestor-super-venda').value) || 0
        }
    };

    window.dbUpdate(window.dbRef(window.db, `imobiliarias/${gestorImobiliariaId}`), {
        metas: dadosMetas
    }).then(() => {
        alert("Configurações da Imobiliária salvas! Os corretores terão os campos bloqueados.");
        atualizarPaineis();
    }).catch((erro) => {
        // ADICIONE ESTE BLOCO CATCH
        alert("Erro ao salvar as configurações: " + erro.message);
        console.error(erro);
    });
};