        // Inicialização ao carregar a página
        document.addEventListener('DOMContentLoaded', () => {
            definirFiltroMesAtual();
            renderDashboard();
            renderLista();
            iniciarMonitorAlertas();
        });
        function formatarMoeda(valor) {
            return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
        }

        // Obter dados do LocalStorage
        function getLembretes() {
            return JSON.parse(localStorage.getItem('meusLembretes')) || [];
        }

        // Guardar dados no LocalStorage
        function saveLembretes(lembretes) {
            localStorage.setItem('meusLembretes', JSON.stringify(lembretes));
            renderDashboard();
            renderLista();
        }

        // Função auxiliar para formatar a data no padrão YYYY-MM-DD (exigido pelo input type="date")
        function formatarDataParaInput(data) {
            const ano = data.getFullYear();
            const mes = String(data.getMonth() + 1).padStart(2, '0');
            const dia = String(data.getDate()).padStart(2, '0');
            return `${ano}-${mes}-${dia}`;
        }

// Função para preencher os inputs com o primeiro e último dia do mês atual
        function definirFiltroMesAtual() {
            const hoje = new Date();
            // Pega o primeiro dia do mês atual
            const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            // Pega o último dia do mês atual (passar 0 no dia do próximo mês retorna o último dia do mês atual)
            const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

            document.getElementById('dash-data-inicio').value = formatarDataParaInput(primeiroDia);
            document.getElementById('dash-data-fim').value = formatarDataParaInput(ultimoDia);
        }

        // Navegação entre Tabs
        function switchTab(tabId) {
            // Esconder todas as tabs
            document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
            
            // Mostrar a tab selecionada
            document.getElementById(`tab-${tabId}`).classList.add('active');
            document.getElementById(`btn-tab-${tabId}`).classList.add('active');

            if(tabId === 'dashboard') renderDashboard();
            if(tabId === 'list') renderLista();
        }

      // Preparar Formulário para Novo
       function prepararNovoAgendamento() {
            document.getElementById('form-id').value = '';
            document.getElementById('form-referencia').value = '';
            document.getElementById('form-valor').value = ''; // Limpa o novo campo
            document.getElementById('form-detalhes').value = '';
            document.getElementById('form-datahora').value = '';
            
            document.querySelector('input[name="form-acompanhamento"][value="Acompanhar"]').checked = true;
            document.querySelector('input[name="form-chave"][value="Locabens"]').checked = true;
            
            document.getElementById('form-title').innerText = 'Agendar Nova Visita';
            switchTab('form');
        }

        // Preparar Formulário para Edição
        function prepararEdicao(id) {
        const lembretes = getLembretes();
        const item = lembretes.find(l => l.id === id);
        
            if (item) {
                document.getElementById('form-id').value = item.id;
                document.getElementById('form-referencia').value = item.nome;
                document.getElementById('form-valor').value = item.valor || ''; // Preenche o valor (se existir)
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

        // Guardar/Atualizar Agendamento
       function salvarAgendamento(e) {
            e.preventDefault();
            
            const idEdicao = document.getElementById('form-id').value;
            const nome = document.getElementById('form-referencia').value;
            // Captura o valor como número (se estiver vazio, guarda 0)
            const valor = parseFloat(document.getElementById('form-valor').value) || 0; 
            const texto = document.getElementById('form-detalhes').value;
            const horario = document.getElementById('form-datahora').value;
            
            const acompanhamento = document.querySelector('input[name="form-acompanhamento"]:checked').value;
            const chave = document.querySelector('input[name="form-chave"]:checked').value;

            let lembretes = getLembretes();
            let resultadoExistente = null;

            if (idEdicao) {
                const itemAntigo = lembretes.find(l => l.id == idEdicao);
                if (itemAntigo) resultadoExistente = itemAntigo.resultado;
                lembretes = lembretes.filter(item => item.id != idEdicao);
            }

            const novoItem = {
                id: idEdicao ? parseInt(idEdicao) : Date.now(),
                nome: nome,
                valor: valor, // Guarda o valor no objeto
                texto: texto,
                horario: horario,
                acompanhamento: acompanhamento,
                chave: chave,
                status: `${acompanhamento} - Chave ${chave}`, 
                resultado: resultadoExistente
            };

            lembretes.push(novoItem);
            saveLembretes(lembretes);
            switchTab('list');
        }

        // Alterar Estado / Remover
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

        // Lógica da Lista de Agendamentos
        function renderLista() {
    const tbody = document.getElementById('tabela-corpo');
    const termoBusca = document.getElementById('busca-lista').value.toLowerCase();
    const verFinalizados = document.getElementById('ver-finalizados').checked;
    
    let lembretes = getLembretes();
    
    // Filtros
    let filtrados = lembretes.filter(item => {
        const atendeStatus = verFinalizados ? true : !item.resultado;
        const atendeBusca = item.nome.toLowerCase().includes(termoBusca) || item.texto.toLowerCase().includes(termoBusca);
        return atendeStatus && atendeBusca;
    });

    // Ordenação (mais antigos primeiro)
    filtrados.sort((a, b) => new Date(a.horario) - new Date(b.horario));

    tbody.innerHTML = '';

    // Ajustado colspan para 6 devido à nova coluna de valor
    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">Nenhum agendamento encontrado.</td></tr>`;
        return;
    }

    filtrados.forEach(item => {
            const tr = document.createElement('tr');
            if (item.resultado) tr.classList.add('is-finished');

            const dataFormatada = new Date(item.horario).toLocaleString('pt-PT');
            
            // FORMATA O VALOR PARA EXIBIR NA TABELA
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

            // Escolher a cor correta dependendo de qual chave foi selecionada
            let classeChave = 'badge-pending'; // Amarelo por padrão (caso haja outra no futuro)
            
            if (item.chave === 'Locabens' || (item.status && item.status.includes('Locabens'))) {
                classeChave = 'badge-locabens';
            } else if (item.chave === 'Redentora' || (item.status && item.status.includes('Redentora'))) {
                classeChave = 'badge-redentora';
            }

            // Criar badges bonitas para a tabela
            let htmlStatus = '';
            if (item.acompanhamento && item.chave) {
                htmlStatus = `<span class="badge badge-neutral">${item.acompanhamento}</span> <span class="badge ${classeChave}" style="margin-top:4px;">${item.chave}</span>`;
            } else {
                htmlStatus = `<span class="badge ${classeChave}">${item.status}</span>`; // Para agendamentos antigos
            }

            // Nova coluna inserida logo abaixo de "Referência / Detalhes"
            tr.innerHTML = `
                <td>
                    <div style="font-weight: bold; text-transform: uppercase;">${item.nome}</div>
                    <div style="color: var(--text-muted); margin-top: 4px; white-space: pre-wrap;">${item.texto}</div>
                </td>
                <td style="font-weight: 600; color: var(--primary);">${valorFormatado}</td>
                <td style="font-weight: 500;"><i class="fa-regular fa-calendar" style="color: var(--text-muted); margin-right: 6px;"></i>${dataFormatada}</td>
                <td><div style="display:flex; flex-direction:column; align-items:flex-start;">${htmlStatus}</div></td>
                <td>${badgeResultado}</td>
                <td><div class="actions-group">${acoesHtml}</div></td>
            `;
            tbody.appendChild(tr);
        });
    }

        // Lógica do Dashboard
        function limparFiltrosDashboard() {
            document.getElementById('dash-data-inicio').value = '';
            document.getElementById('dash-data-fim').value = '';
            renderDashboard();
        }

        function renderDashboard() {
            let lembretes = getLembretes();
            const dataInicio = document.getElementById('dash-data-inicio').value;
            const dataFim = document.getElementById('dash-data-fim').value;

            // Lógica do Destaque Próxima Visita (mantida igual)
            const agora = new Date();
            const futuros = lembretes
                .filter(item => new Date(item.horario) >= agora && !item.resultado)
                .sort((a, b) => new Date(a.horario) - new Date(b.horario));
            
            const contentProxima = document.getElementById('proxima-visita-content');
            if (futuros.length > 0) {
                const proximo = futuros[0];
                contentProxima.innerHTML = `
                    <h3 style="font-size: 1.5rem; font-weight: bold; text-transform: uppercase;">${proximo.nome}</h3>
                    <p style="color: #0a0707c5; font-size: 1.125rem; margin-top: 4px;">${proximo.texto}</p>
                    <div style="display: inline-flex; align-items: center; gap: 8px; background: #f1f5f9; padding: 8px 16px; border-radius: 8px; margin-top: 16px; font-weight: bold;">
                        <i class="fa-regular fa-calendar-check"></i> ${new Date(proximo.horario).toLocaleString('pt-PT')}
                    </div>
                `;
            } else {
                contentProxima.innerHTML = `<p style="color: #0a0707c5; font-style: italic;">Nenhuma visita futura agendada no momento.</p>`;
            }

            // Aplicar Filtros de Data
            let filtrados = lembretes;
            if (dataInicio || dataFim) {
                filtrados = lembretes.filter(item => {
                    const dataItemStr = item.horario.split('T')[0];
                    const dInicioOk = dataInicio ? dataItemStr >= dataInicio : true;
                    const dFimOk = dataFim ? dataItemStr <= dataFim : true;
                    return dInicioOk && dFimOk;
                });
            }

            // Separar as listas por status
            const pendentesList = filtrados.filter(v => !v.resultado);
            const efetivadosList = filtrados.filter(v => v.resultado === 'Efetivado');
            const frustradosList = filtrados.filter(v => v.resultado === 'Frustrado');

            // Atualiza as quantidades
            document.getElementById('count-total').innerText = filtrados.length;
            document.getElementById('count-pendentes').innerText = pendentesList.length;
            document.getElementById('count-efetivados').innerText = efetivadosList.length;
            document.getElementById('count-frustrados').innerText = frustradosList.length;

            // Calcula as somatórias financeiras usando reduce
            const sumTotal = filtrados.reduce((acc, curr) => acc + (curr.valor || 0), 0);
            const sumPendentes = pendentesList.reduce((acc, curr) => acc + (curr.valor || 0), 0);
            const sumEfetivados = efetivadosList.reduce((acc, curr) => acc + (curr.valor || 0), 0);
            const sumFrustrados = frustradosList.reduce((acc, curr) => acc + (curr.valor || 0), 0);

            // Exibe os valores formatados no HTML
            document.getElementById('valor-total').innerText = formatarMoeda(sumTotal);
            document.getElementById('valor-pendentes').innerText = formatarMoeda(sumPendentes);
            document.getElementById('valor-efetivados').innerText = formatarMoeda(sumEfetivados);
            document.getElementById('valor-frustrados').innerText = formatarMoeda(sumFrustrados);
        }

        // Sistema de Alertas
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
                
                const agoraF = agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0') + '-' + 
                               String(agora.getDate()).padStart(2, '0') + 'T' + String(agora.getHours()).padStart(2, '0') + 
                               ':' + String(agora.getMinutes()).padStart(2, '0');

                lembretes.forEach(item => {
                    if (item.horario === agoraF && !item.resultado) {
                        mostrarAlerta(`⏰ HORA DA VISITA:\n${item.nome.toUpperCase()}\n${item.texto}`);
                    }
                });
            }, 10000);
        }    


           // --- EXPORTAR DADOS PARA CSV ---
        // --- FUNÇÕES DO MODAL DE EXPORTAÇÃO ---
        function exportarAgendamentos() {
            // Quando clica no botão do menu, abre a janela e pré-preenche com o mês atual
            const hoje = new Date();
            const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

            document.getElementById('export-data-inicio').value = formatarDataParaInput(primeiroDia);
            document.getElementById('export-data-fim').value = formatarDataParaInput(ultimoDia);

            document.getElementById('exportar-modal').classList.add('show');
        }

        function fecharModalExportar() {
            document.getElementById('exportar-modal').classList.remove('show');
        }

        // --- GERAR O PDF COM FILTRO DE DATAS ---
        // --- GERAR O PDF COM FILTRO DE DATAS ---
    // --- GERAR O PDF COM FILTRO DE DATAS E RESUMO NO FINAL ---
    function gerarPDF() {
        const dataInicio = document.getElementById('export-data-inicio').value;
        const dataFim = document.getElementById('export-data-fim').value;
        let lembretes = getLembretes();

        // 1. Filtrar pelas datas escolhidas no modal
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

        // Ordenar por data para o PDF ficar organizado cronologicamente
        lembretes.sort((a, b) => new Date(a.horario) - new Date(b.horario));

        // 2. Inicializar o jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Título
        doc.setFontSize(18);
        doc.text("Relatório de Agendamentos - LocAgenda", 14, 20);
        
        // Subtítulo mostrando o período escolhido
        doc.setFontSize(10);
        doc.setTextColor(100);
        const dataInicioPt = dataInicio ? dataInicio.split('-').reverse().join('/') : 'Início';
        const dataFimPt = dataFim ? dataFim.split('-').reverse().join('/') : 'Fim';
        doc.text(`Período filtrado: ${dataInicioPt} a ${dataFimPt}`, 14, 28);

        // Preparar colunas e linhas
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

        // 3. Desenhar a tabela no PDF
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

        // --- 4. CÁLCULO E INSERÇÃO DO RESUMO NO FINAL ---
        
        // Separar as listas
        const pendentesList = lembretes.filter(v => !v.resultado);
        const efetivadosList = lembretes.filter(v => v.resultado === 'Efetivado');
        const frustradosList = lembretes.filter(v => v.resultado === 'Frustrado');

        // Somatórias
        const sumTotal = lembretes.reduce((acc, curr) => acc + (curr.valor || 0), 0);
        const sumPendentes = pendentesList.reduce((acc, curr) => acc + (curr.valor || 0), 0);
        const sumEfetivados = efetivadosList.reduce((acc, curr) => acc + (curr.valor || 0), 0);
        const sumFrustrados = frustradosList.reduce((acc, curr) => acc + (curr.valor || 0), 0);

        // Pegar a posição Y onde a tabela acabou
        let finalY = doc.lastAutoTable.finalY;

        // Verificar se há espaço suficiente na página para o resumo, senão cria uma nova página
        if (finalY > 250) {
            doc.addPage();
            finalY = 20;
        } else {
            finalY += 15; // Dá um pequeno espaçamento após a tabela
        }

        // Título do Resumo
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59); // Cor escura
        doc.setFont("helvetica", "bold");
        doc.text("Resumo do Período", 14, finalY);

        // Dados do Resumo
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        
        // Coluna 1: Quantidades
        doc.text(`Total de Visitas: ${lembretes.length}`, 14, finalY + 8);
        doc.text(`Pendentes: ${pendentesList.length}`, 14, finalY + 14);
        doc.text(`Efetivados: ${efetivadosList.length}`, 14, finalY + 20);
        doc.text(`Frustrados: ${frustradosList.length}`, 14, finalY + 26);

        // Coluna 2: Valores Financeiros
        doc.text(`Valor Total: ${formatarMoeda(sumTotal)}`, 80, finalY + 8);
        doc.text(`Valor Pendentes: ${formatarMoeda(sumPendentes)}`, 80, finalY + 14);
        doc.text(`Valor Efetivados: ${formatarMoeda(sumEfetivados)}`, 80, finalY + 20);
        doc.text(`Valor Frustrados: ${formatarMoeda(sumFrustrados)}`, 80, finalY + 26);

        // 5. Fechar janela e fazer download
        fecharModalExportar();
        const nomeFicheiro = `LocAgenda_Relatorio_${dataInicioPt}_a_${dataFimPt}.pdf`.replace(/\//g, '-');
        doc.save(nomeFicheiro);
    }
