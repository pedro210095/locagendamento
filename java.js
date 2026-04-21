// Variáveis globais 
let lembretesLocais = [];
let agendamentosRef = null;
let chartConversaoInstancia = null; 
let chartChavesInstancia = null; 

// ==========================================
// AUTENTICAÇÃO E SINCRONIZAÇÃO COM FIREBASE
// ==========================================
function monitorarAutenticacao() {
    if (!window.onAuthStateChanged) { setTimeout(monitorarAutenticacao, 500); return; }
    
    window.onAuthStateChanged(window.auth, (user) => {
        if (user) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-container-main').style.display = 'flex';
            
            agendamentosRef = window.dbRef(window.db, `usuarios/${user.uid}/agendamentos`);
            
            window.dbOnValue(agendamentosRef, (snapshot) => {
                const data = snapshot.val();
                lembretesLocais = data ? Object.values(data) : [];
                renderDashboard();
                renderLista();
            });
        } else {
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('app-container-main').style.display = 'none';
        }
    });
}

window.fazerLogout = () => { 
    if(confirm("Tem certeza que deseja sair da conta?")) window.logout(); 
};

function getLembretes() {
    return lembretesLocais || [];
}

function saveLembretes(lembretes) {
    if (agendamentosRef) {
        window.dbSet(agendamentosRef, lembretes);
    }
}

// ==========================================
// INICIALIZAÇÃO DA APLICAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
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

// Função para calcular o tempo que falta para a visita
function calcularTempoRestante(dataHoraVisita) {
    const agora = new Date();
    const dataVisita = new Date(dataHoraVisita);
    const diffMs = dataVisita - agora;

    if (diffMs <= 0) return "A visita já deveria ter iniciado!";

    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let partes = [];
    if (dias > 0) partes.push(`${dias}d`);
    if (horas > 0) partes.push(`${horas}h`);
    if (minutos > 0 || partes.length === 0) partes.push(`${minutos}min`);

    return `Falta(m): ${partes.join(' ')}`;
}

// Ciclo da imobiliária (Do dia 26 ao dia 25)
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
    document.getElementById(`btn-tab-${tabId}`).classList.add('active');

    if(tabId === 'dashboard') renderDashboard();
    if(tabId === 'list') renderLista();
}

// ==========================================
// FORMULÁRIOS (NOVO / EDITAR / SALVAR)
// ==========================================
function prepararNovoAgendamento() {
    document.getElementById('form-id').value = '';
    document.getElementById('form-referencia').value = '';
    document.getElementById('form-valor').value = ''; 
    document.getElementById('form-detalhes').value = '';
    document.getElementById('form-datahora').value = '';
    
    document.querySelector('input[name="form-acompanhamento"][value="Acompanhar"]').checked = true;
    document.querySelector('input[name="form-chave"][value="Locabens"]').checked = true;
    
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
        
        const valAcompanhamento = item.acompanhamento || (item.status && item.status.includes('Não') ? 'Não Acompanhar' : 'Acompanhar');
        const valChave = item.chave || (item.status && item.status.includes('Redentora') ? 'Redentora' : 'Locabens');
        
        document.querySelector(`input[name="form-acompanhamento"][value="${valAcompanhamento}"]`).checked = true;
        document.querySelector(`input[name="form-chave"][value="${valChave}"]`).checked = true;
        
        document.getElementById('form-title').innerText = 'Reagendar / Editar Visita';
        switchTab('form');
    }
}

function salvarAgendamento(e) {
    if (e) e.preventDefault();
    
    try {
        const idEdicao = document.getElementById('form-id').value;
        const nome = document.getElementById('form-referencia').value;
        const valor = parseFloat(document.getElementById('form-valor').value) || 0; 
        const texto = document.getElementById('form-detalhes').value;
        const horario = document.getElementById('form-datahora').value;
        
        const acompanhamento = document.querySelector('input[name="form-acompanhamento"]:checked').value;
        const chave = document.querySelector('input[name="form-chave"]:checked').value;
        
        let lembretes = getLembretes().filter(item => item != null); 
        let resultadoExistente = null;

        if (idEdicao) {
            const itemAntigo = lembretes.find(l => l.id == idEdicao);
            if (itemAntigo && itemAntigo.resultado) {
                resultadoExistente = itemAntigo.resultado;
            }
            lembretes = lembretes.filter(item => item.id != idEdicao);
        }

        const novoItem = {
            id: idEdicao ? parseInt(idEdicao) : Date.now(),
            nome: nome,
            valor: valor, 
            texto: texto,
            horario: horario,
            acompanhamento: acompanhamento,
            chave: chave,
            status: `${acompanhamento} - Chave ${chave}`
        };

        if (resultadoExistente) {
            novoItem.resultado = resultadoExistente;
        }
        
        lembretes.push(novoItem);
        saveLembretes(lembretes);
        
        document.getElementById('agendamento-form').reset();
        document.getElementById('form-id').value = '';
        switchTab('list'); 

    } catch (erro) {
        console.error(erro);
        alert("Ops! Ocorreu um erro ao salvar: " + erro.message);
    }
}

// ==========================================
// AÇÕES DE LISTA (STATUS / REMOVER)
// ==========================================
function marcarStatus(id, novoStatus) {
    let lembretes = getLembretes();
    const index = lembretes.findIndex(item => item.id === id);
    if (index !== -1) {
        lembretes[index].resultado = novoStatus;
        saveLembretes(lembretes);
    }
}

function removerLembrete(id) {
    if(confirm('Tem a certeza que deseja apagar este agendamento?')) {
        let lembretes = getLembretes();
        lembretes = lembretes.filter(item => item.id !== id);
        saveLembretes(lembretes);
    }
}

// ==========================================
// RENDERIZAÇÃO DA TABELA (LISTA)
// ==========================================
function renderLista() {
    const tbody = document.getElementById('tabela-corpo');
    const termoBusca = document.getElementById('busca-lista').value.toLowerCase();
    const verFinalizados = document.getElementById('ver-finalizados').checked;
    
    let lembretes = getLembretes();

    let filtrados = lembretes.filter(item => {
        const atendeStatus = verFinalizados ? true : !item.resultado;
        const atendeBusca = item.nome.toLowerCase().includes(termoBusca) || item.texto.toLowerCase().includes(termoBusca);
        return atendeStatus && atendeBusca;
    });

    filtrados.sort((a, b) => new Date(a.horario) - new Date(b.horario));

    tbody.innerHTML = '';
    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">Nenhum agendamento encontrado.</td></tr>`;
        return;
    }

    filtrados.forEach(item => {
        const tr = document.createElement('tr');
        if (item.resultado) tr.classList.add('is-finished');

        const dataFormatada = new Date(item.horario).toLocaleString('pt-PT');
        const valorFormatado = item.valor ? formatarMoeda(item.valor) : 'R$ 0,00';
        
        let badgeResultado = `<span class="badge badge-pending"><i class="fa-regular fa-clock"></i> Pendente</span>`;
        if (item.resultado === 'Efetivado') badgeResultado = `<span class="badge badge-success"><i class="fa-solid fa-check"></i> Efetivado</span>`;
        if (item.resultado === 'Frustrado') badgeResultado = `<span class="badge badge-danger"><i class="fa-solid fa-xmark"></i> Frustrado</span>`;

        let acoesHtml = '';
        if (item.resultado) {
            acoesHtml = `
                <button class="btn-action btn-action-neutral" title="Restaurar" onclick="marcarStatus(${item.id}, null)"><i class="fa-solid fa-rotate-left"></i></button>
                <button class="btn-action btn-action-danger" title="Apagar" onclick="removerLembrete(${item.id})"><i class="fa-solid fa-trash"></i></button>
            `;
        } else {
            acoesHtml = `
                <button class="btn-action btn-action-success" title="Efetivado" onclick="marcarStatus(${item.id}, 'Efetivado')"><i class="fa-solid fa-check"></i></button>
                <button class="btn-action btn-action-warning" title="Frustrado" onclick="marcarStatus(${item.id}, 'Frustrado')"><i class="fa-solid fa-xmark"></i></button>
                <button class="btn-action btn-action-info" title="Reagendar" onclick="prepararEdicao(${item.id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-action btn-action-danger" title="Apagar" onclick="removerLembrete(${item.id})"><i class="fa-solid fa-trash"></i></button>
            `;
        }

        let classeChave = 'badge-pending';
        if (item.chave === 'Locabens' || (item.status && item.status.includes('Locabens'))) {
            classeChave = 'badge-locabens';
        } else if (item.chave === 'Redentora' || (item.status && item.status.includes('Redentora'))) {
            classeChave = 'badge-redentora';
        }

        let htmlStatus = '';
        if (item.acompanhamento && item.chave) {
            htmlStatus = `<span class="badge badge-neutral">${item.acompanhamento}</span> <span class="badge ${classeChave}" style="margin-top:4px;">${item.chave}</span>`;
        } else {
            htmlStatus = `<span class="badge ${classeChave}">${item.status}</span>`;
        }

        tr.innerHTML = `
            <td>
                <div style="font-weight: bold; text-transform: uppercase; font-size: 0.95rem;">${item.nome}</div>
                <div style="color: var(--text-muted); margin-top: 4px; white-space: pre-wrap; font-size: 0.85rem;">${item.texto}</div>
            </td>
            <td style="font-weight: 600; color: var(--primary);">${valorFormatado}</td>
            <td style="font-weight: 500; font-size: 0.85rem;"><i class="fa-regular fa-calendar" style="color: var(--text-muted); margin-right: 6px;"></i>${dataFormatada}</td>
            <td><div style="display:flex; flex-direction:column; align-items:flex-start;">${htmlStatus}</div></td>
            <td>${badgeResultado}</td>
            <td><div class="actions-group">${acoesHtml}</div></td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================
// DASHBOARD E GRÁFICOS
// ==========================================
function limparFiltrosDashboard() {
    definirFiltroMesAtual(); 
    renderDashboard();
}

function renderDashboard() {
    let lembretes = getLembretes();
    const dataInicio = document.getElementById('dash-data-inicio').value;
    const dataFim = document.getElementById('dash-data-fim').value;

    const agora = new Date();
    const futuros = lembretes
        .filter(item => new Date(item.horario) >= agora && !item.resultado)
        .sort((a, b) => new Date(a.horario) - new Date(b.horario));
        
    const contentProxima = document.getElementById('proxima-visita-content');
    
    if (futuros.length > 0) {
        const proximo = futuros[0];
        const tempoRestante = calcularTempoRestante(proximo.horario); 

        contentProxima.innerHTML = `
            <h3 style="font-size: 1.3rem; font-weight: bold; text-transform: uppercase;">${proximo.nome}</h3>
            <p style="color: #0a0707c5; font-size: 1rem; margin-top: 4px;">${proximo.texto}</p>
            
            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px;">
                <div style="display: inline-flex; align-items: center; gap: 8px; background: #f1f5f9; padding: 8px 14px; border-radius: 8px; font-weight: bold; font-size: 0.9rem;">
                    <i class="fa-regular fa-calendar-check"></i> ${new Date(proximo.horario).toLocaleString('pt-PT')}
                </div>
                
                <div style="display: inline-flex; align-items: center; gap: 8px; background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; padding: 8px 14px; border-radius: 8px; font-weight: bold; font-size: 0.9rem;">
                    <i class="fa-solid fa-hourglass-half fa-spin"></i> ${tempoRestante}
                </div>
            </div>
        `;
    } else {
        contentProxima.innerHTML = `<p style="color: #0a0707c5; font-style: italic;">Nenhuma visita futura agendada no momento.</p>`;
    }

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

    // CONTAGEM PARA O GRÁFICO DE CHAVES
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

    // ATUALIZA OS GRÁFICOS
    atualizarGraficos(efetivadosList.length, frustradosList.length, locabensCount, redentoraCount);
}

function atualizarGraficos(efetivados, frustrados, locabens, redentora) {
    const ctxConv = document.getElementById('chartConversao');
    if (ctxConv) {
        if (chartConversaoInstancia) chartConversaoInstancia.destroy();
        chartConversaoInstancia = new Chart(ctxConv.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Efetivados', 'Frustrados'],
                datasets: [{
                    data: [efetivados, frustrados],
                    backgroundColor: ['#16a34a', '#ef4444'], 
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    const ctxChaves = document.getElementById('chartChaves');
    if (ctxChaves) {
        if (chartChavesInstancia) chartChavesInstancia.destroy();
        chartChavesInstancia = new Chart(ctxChaves.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Locabens', 'Redentora'],
                datasets: [{
                    data: [locabens, redentora],
                    backgroundColor: ['#3b82f6', '#a855f7'], 
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }
}

// ==========================================
// ALERTAS EM TEMPO REAL
// ==========================================
function mostrarAlerta(mensagem) {
    document.getElementById('alerta-texto').innerText = mensagem;
    document.getElementById('alerta-modal').classList.add('show');
}

function fecharAlerta() {
    document.getElementById('alerta-modal').classList.remove('show');
}

function iniciarMonitorAlertas() {
    setInterval(() => {
        const lembretes = getLembretes();
        const agora = new Date();
        
        const agoraF = agora.getFullYear() + 
                       '-' + String(agora.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(agora.getDate()).padStart(2, '0') + 'T' + String(agora.getHours()).padStart(2, '0') + 
                       ':' + String(agora.getMinutes()).padStart(2, '0');

        lembretes.forEach(item => {
            if (item.horario === agoraF && !item.resultado) {
                mostrarAlerta(`⏰ HORA DA VISITA:\n${item.nome.toUpperCase()}\n${item.texto}`);
            }
        });
        
        // Também atualiza o relógio no dashboard se estiver na tab ativa
        if(document.getElementById('tab-dashboard').classList.contains('active')) {
            renderDashboard();
        }
    }, 10000); 
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

function fecharModalExportar() {
    document.getElementById('exportar-modal').classList.remove('show');
}

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
        columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 25 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 25 },
            4: { cellWidth: 25 },
            5: { cellWidth: 22 }
        }
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