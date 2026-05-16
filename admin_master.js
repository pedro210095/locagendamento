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
// LÓGICA DE ADMIN MASTER (admin_master.js)
// ==========================================

const MEU_UID_ADMIN = "hoBmS4JbQAN9TDM4DpMI0lGicWE3";
let dadosGlobaisUsuarios = {}; 
let dadosGlobaisImobiliarias = {}; // Adicionado para controlo global

// Função que espera o Firebase carregar antes de verificar o login
function iniciarAdmin() {
    if (!window.onAuthStateChanged || !window.auth) {
        setTimeout(iniciarAdmin, 500);
        return;
    }

    window.onAuthStateChanged(window.auth, (user) => {
        if (user) {
            // Verificação de Segurança Master
            if (user.uid === MEU_UID_ADMIN || user.email === "pedro210095@gmail.com") {
                document.getElementById('admin-lock-screen').style.display = 'none';
                document.getElementById('admin-container').style.display = 'flex';
                carregarDadosGlobais();
            } else {
                alert("Acesso Negado: Você não tem permissões de Admin Master.");
                window.location.href = "index.html";
            }
        } else {
            window.location.href = "index.html";
        }
    });
}

iniciarAdmin();

// Carregamento centralizado de dados
function carregarDadosGlobais() {
    const db = window.db;
    
    // Escuta Utilizadores
    window.dbOnValue(window.dbRef(db, 'usuarios'), (snapshot) => {
        const usuarios = snapshot.val() || {};
        window.dadosGlobaisUsuarios = usuarios; 
        
        // Escuta Imobiliárias para renderizar os grupos corretamente
        window.dbGet(window.dbRef(db, 'imobiliarias')).then((imobSnap) => {
            const imobiliarias = imobSnap.val() || {};
            window.dadosGlobaisImobiliarias = imobiliarias; // Atualiza variável global com window

            // AQUI ESTÁ O SEGREDO: Adicione o ", imobiliarias" aqui
            renderizarTabelaMaster(usuarios, imobiliarias);
            renderizarTabelaImobiliarias(usuarios, imobiliarias);
            renderizarTabelaSolo(usuarios);
            atualizarStatsGlobais(usuarios);
        });
    });
}

// ==========================================
// LÓGICA DE ABAS E NAVEGAÇÃO
// ==========================================

window.switchAdminTab = function(tabNome) {
    // Esconde todas as secções
    document.getElementById('tab-global').style.display = 'none';
    document.getElementById('tab-equipes').style.display = 'none';
    document.getElementById('tab-solo').style.display = 'none';
    document.getElementById('tab-sys').style.display = 'none'; // Adicione esta linha!
    
    // Tira a classe 'active' de todos os botões
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // Mostra a aba selecionada
    document.getElementById(`tab-${tabNome}`).style.display = 'block';
    document.getElementById(`btn-tab-${tabNome}`).classList.add('active');

    // NOVA LÓGICA: Se entrar na aba de sistema, carrega os dados atuais
    if(tabNome === 'sys') carregarConfiguracoesSistema();
};

// ==========================================
// RENDERIZAÇÃO DAS TABELAS
// ==========================================

function renderizarTabelaMaster(usuarios, imobiliarias) {
    const tbody = document.getElementById('tabela-master-corpo');
    tbody.innerHTML = '';

    const listaImob = imobiliarias || window.dadosGlobaisImobiliarias || {};

    Object.keys(usuarios).forEach(uid => {
        const user = usuarios[uid];
        const perfil = user.perfil || {};
        
        const nomeProfissional = perfil.configGeral?.perfil?.nomeProfissional || perfil.nomeProfissional || "Utilizador sem Nome";
        const email = perfil.email || user.email || "---";
        const letraAvatar = nomeProfissional.charAt(0).toUpperCase();

        let papel = '';

        const qtdImobiliarias = perfil.listaImobiliarias ? Object.keys(perfil.listaImobiliarias).length : (perfil.imobiliariaId ? 1 : 0);

        // 1. Verifica se o utilizador pertence a MÚLTIPLAS Imobiliárias
        if (qtdImobiliarias > 1) {
            const cargo = (perfil.nivelAcesso === 'gestor') ? 'Gestor Multi' : 'Corretor Multi';
            papel = `<span class="badge badge-role-gestor" style="background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">
                        <i class="fa-solid fa-building"></i> ${qtdImobiliarias} Imobiliárias (${cargo})
                     </span>`;
        }
        // 2. Verifica se pertence a UMA Imobiliária registrada
        else if (perfil.imobiliariaId && perfil.imobiliariaId !== "") {
            const nomeImob = listaImob[perfil.imobiliariaId]?.nome || 'Imobiliária não encontrada';
            const cargo = (perfil.nivelAcesso === 'gestor') ? 'Gestor' : 'Corretor';
            
            papel = `<span class="badge badge-role-gestor" style="background: #e0f2fe; color: #0369a1; border-color: #bae6fd;">
                        <i class="fa-solid fa-building"></i> ${nomeImob}: ${cargo}
                     </span>`;
        } 
        // Se for apenas Gestor Solo
        else if (perfil.nivelAcesso === 'gestor') {
            papel = `<span class="badge badge-role-gestor">Gestor Solo</span>`;
        } 
        // Se for Corretor Solo
        else {
            papel = `<span class="badge badge-role-solo">Corretor Solo</span>`;
        }

        const statusConta = perfil.status === 'suspenso' ? 
            `<span class="badge badge-danger">Suspenso</span>` : 
            `<span class="badge badge-success">Ativo</span>`;

        const ultimoAcesso = perfil.ultimoAcesso 
            ? new Date(perfil.ultimoAcesso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) 
            : 'Nunca';

        const btnPromoverRebaixar = perfil.nivelAcesso === 'gestor' 
            ? `<button class="btn-governança btn-demote" onclick="removerGestor('${uid}')" title="Remover de Gestor"><i class="fa-solid fa-arrow-down"></i></button>`
            : `<button class="btn-governança btn-promote" onclick="promover('${uid}')" title="Promover a Gestor"><i class="fa-solid fa-arrow-up"></i></button>`;

        const btnSuspenderReativar = perfil.status === 'suspenso'
            ? `<button class="btn-governança btn-promote" onclick="suspender('${uid}')" title="Reativar Conta"><i class="fa-solid fa-check"></i></button>`
            : `<button class="btn-governança btn-suspend" onclick="suspender('${uid}')" title="Suspender Conta"><i class="fa-solid fa-ban"></i></button>`;

        const tr = document.createElement('tr');
      // NOVO: Adiciona um atributo "data-search" escondido na linha com tudo em minúsculas para o filtro funcionar rápido
        const searchStr = `${nomeProfissional.toLowerCase()} ${email.toLowerCase()} ${uid.toLowerCase()}`;
        tr.setAttribute('data-search', searchStr);

        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; background: #cbd5e1; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8rem;">${letraAvatar}</div>
                    <div><b>${nomeProfissional}</b><br><small style="color: #64748b;">${email}</small></div>
                </div>
            </td>
            <td>${papel}</td>
            <td>${ultimoAcesso}</td>
            <td>${statusConta}</td>
            <td style="text-align: right;">
                <button class="btn-governança btn-view-as" onclick="verComo('${uid}')" title="Entrar como"><i class="fa-solid fa-eye"></i></button>
                ${btnPromoverRebaixar}
                ${btnSuspenderReativar}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderizarTabelaImobiliarias(usuarios, imobiliarias) {
    const tbody = document.getElementById('tabela-imobiliarias-corpo');
    if(!tbody) return;
    tbody.innerHTML = '';

    Object.keys(imobiliarias).forEach(idImob => {
        const imob = imobiliarias[idImob];
        
        const membrosDoGrupo = Object.values(usuarios).filter(u => {
            const p = u.perfil || {};
            // Agora verifica se ele está no campo antigo OU na lista nova
            return p.imobiliariaId === idImob || (p.listaImobiliarias && p.listaImobiliarias[idImob]);
        });

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${imob.nome}</b></td>
            <td><span style="font-family: monospace; background: #e2e8f0; padding: 4px 8px; border-radius: 4px;">${idImob}</span></td>
            <td style="text-align: center;"><span class="badge badge-info"><i class="fa-solid fa-users"></i> ${membrosDoGrupo.length} Membros</span></td>
            <td style="text-align: right;">
                <button class="btn-governança btn-promote" onclick="abrirModalGerirMembros('${idImob}', '${imob.nome}')" title="Incluir/Remover Membros">
                    <i class="fa-solid fa-users-gear"></i> Membros
                </button>
                <button class="btn-governança btn-suspend" onclick="excluirImobiliaria('${idImob}', '${imob.nome}')" title="Excluir Imobiliária">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderizarTabelaSolo(usuarios) {
    const tbody = document.getElementById('tabela-solo-corpo');
    if(!tbody) return;
    tbody.innerHTML = '';

    Object.keys(usuarios).forEach(uid => {
        const perfil = usuarios[uid].perfil || {};
        const temLista = perfil.listaImobiliarias && Object.keys(perfil.listaImobiliarias).length > 0;
        // Verifica se não tem ID antigo E não tem nenhuma imobiliária na lista nova
        if (perfil.nivelAcesso !== 'gestor' && (!perfil.imobiliariaId || perfil.imobiliariaId === "") && !temLista) {
            const nome = perfil.configGeral?.perfil?.nomeProfissional || perfil.nomeProfissional || "Sem Nome";
            const email = perfil.email || usuarios[uid].email || "---";
            const acesso = perfil.ultimoAcesso ? new Date(perfil.ultimoAcesso).toLocaleString('pt-PT', { dateStyle: 'short' }) : 'Nunca';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b>${nome}</b></td>
                <td>${email}</td>
                <td>${acesso}</td>
                <td style="text-align: right;">
                    <button class="btn-governança btn-view-as" onclick="verComo('${uid}')"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn-governança btn-promote" onclick="promover('${uid}')" title="Tornar Gestor"><i class="fa-solid fa-crown"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        }
    });
}

// ==========================================
// FUNÇÕES DE AÇÃO E GOVERNANÇA (ORIGINAIS)
// ==========================================

window.verComo = function(uid) {
    const pRef = window.dbRef(window.db, `usuarios/${uid}/perfil`);
    window.dbGet(pRef).then((snap) => {
        const p = snap.exists() ? snap.val() : {};
        const nome = p.configGeral?.perfil?.nomeProfissional || p.nomeProfissional || "Utilizador";
        if(confirm(`Entrar no modo de visualização para: ${nome}?`)) {
            sessionStorage.setItem('admin_view_as_uid', uid);
            sessionStorage.setItem('admin_view_as_name', nome);
            window.location.href = 'index.html';
        }
    });
};

window.suspender = function(uid) {
    if (uid === window.auth.currentUser.uid) {
        alert("⚠️ Você não pode suspender a sua própria conta.");
        return;
    }
    const perfilRef = window.dbRef(window.db, `usuarios/${uid}/perfil`);
    window.dbGet(perfilRef).then((snap) => {
        let p = snap.exists() ? snap.val() : {};
        const novoStatus = (p.status === 'suspenso') ? 'ativo' : 'suspenso';
        window.dbUpdate(perfilRef, { status: novoStatus }).then(() => {
            alert(novoStatus === 'suspenso' ? "🚫 Conta suspensa!" : "✅ Conta reativada!");
        });
    });
};

window.promover = function(uid) {
    const perfilRef = window.dbRef(window.db, `usuarios/${uid}/perfil`);
    window.dbUpdate(perfilRef, {
        nivelAcesso: 'gestor',
        equipeId: `EQP-${uid.substring(0, 6).toUpperCase()}`
    }).then(() => alert("👑 Promovido a Gestor!"));
};

window.removerGestor = function(uid) {
    if(confirm("Remover cargo de Gestor?")) {
        const perfilRef = window.dbRef(window.db, `usuarios/${uid}/perfil`);
        window.dbUpdate(perfilRef, { nivelAcesso: 'solo', equipeId: null })
        .then(() => alert("🔽 Cargo removido."));
    }
};

// ==========================================
// GESTÃO DE MEMBROS (MODAL COM TABELA E FILTRO)
// ==========================================

window.abrirModalGerirMembros = function(idImob, nomeImob) {
    document.getElementById('span-imob-nome').innerText = nomeImob;
    document.getElementById('input-imob-id-atual').value = idImob;
    document.getElementById('busca-membro-solo').value = ''; // Limpa a pesquisa
    renderizarListasDoModal(idImob);
    document.getElementById('modal-membros-grupo').classList.add('show');
};

window.fecharModalMembrosGrupo = function() {
    document.getElementById('modal-membros-grupo').classList.remove('show');
};

function renderizarListasDoModal(idImob) {
    const corpoMembros = document.getElementById('lista-membros-imob-corpo');
    const corpoSolos = document.getElementById('lista-solos-disponiveis-corpo');
    
    corpoMembros.innerHTML = ''; 
    corpoSolos.innerHTML = '';

    const usuarios = window.dadosGlobaisUsuarios || {};

    Object.keys(usuarios).forEach(uid => {
        const u = usuarios[uid];
        const p = u.perfil || {};
        const nome = p.configGeral?.perfil?.nomeProfissional || p.nomeProfissional || p.email || "Utilizador";
        const email = p.email || u.email || "---";

        // 1. Verifica se já está nesta imobiliária específica
        const jaEstaNoGrupo = (p.imobiliariaId === idImob) || (p.listaImobiliarias && p.listaImobiliarias[idImob]);

        if (jaEstaNoGrupo) {
            const tr = document.createElement('tr');
            const cargo = p.nivelAcesso === 'gestor' ? '👑 Gestor' : '👤 Corretor';
            tr.innerHTML = `
                <td style="padding:10px;"><b>${nome}</b></td>
                <td style="text-align:center;">${cargo}</td>
                <td style="text-align:right;">
                    <button class="btn-governança btn-suspend" onclick="desvincularCorretorDoGrupo('${uid}')">Remover</button>
                </td>`;
            corpoMembros.appendChild(tr);
        } 
        else {
            // --- NOVA LÓGICA DE FILTRO PARA DISPONÍVEIS ---
            
            // Verifica se tem QUALQUER vínculo (campo antigo ou lista nova)
            const temLista = p.listaImobiliarias && Object.keys(p.listaImobiliarias).length > 0;
            const semVinculoNenhum = (!p.imobiliariaId || p.imobiliariaId === "") && !temLista;
            
            // Verifica se é Gestor (Gestores podem aparecer sempre para multi-vínculo)
            const ehGestor = (p.nivelAcesso === 'gestor');

            // Regra: Aparece se (Não tem vínculo nenhum) OU (É Gestor)
            if (semVinculoNenhum || ehGestor) {
                const tr = document.createElement('tr');
                tr.setAttribute('data-search', `${nome.toLowerCase()} ${email.toLowerCase()}`);
                tr.innerHTML = `
                    <td style="padding:10px;"><b>${nome}</b><br><small style="color:#64748b;">${email}</small></td>
                    <td style="text-align:right;">
                        <button class="btn-governança btn-promote" onclick="adicionarMembroAoGrupo('${uid}')">Incluir</button>
                    </td>`;
                corpoSolos.appendChild(tr);
            }
        }
    });

    if (corpoMembros.innerHTML === '') {
        corpoMembros.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px; color:#64748b;">Nenhum membro vinculado.</td></tr>';
    }
}

// NOVA FUNÇÃO: Filtra a tabela de solos conforme o administrador digita
window.filtrarMembrosSolo = function() {
    const termo = document.getElementById('busca-membro-solo').value.toLowerCase();
    const linhas = document.querySelectorAll('#lista-solos-disponiveis-corpo tr');
    
    linhas.forEach(linha => {
        const texto = linha.getAttribute('data-search') || "";
        linha.style.display = texto.includes(termo) ? '' : 'none';
    });
};

window.adicionarMembroAoGrupo = function(uid) {
    const idImob = document.getElementById('input-imob-id-atual').value;
    if(!uid) return;
    
    const perfilRef = window.dbRef(window.db, `usuarios/${uid}/perfil`);
    
    window.dbGet(perfilRef).then((snap) => {
        let imobiliariasAtuais = {};
        // Se ele já tiver a lista nova, carregamos
        if(snap.exists() && snap.val().listaImobiliarias) {
            imobiliariasAtuais = snap.val().listaImobiliarias;
        } 
        // Se ele for um utilizador antigo com apenas um ID, migramos esse ID para a lista
        else if (snap.exists() && snap.val().imobiliariaId) {
            imobiliariasAtuais[snap.val().imobiliariaId] = true;
        }
        
        // Adicionamos a nova imobiliária
        imobiliariasAtuais[idImob] = true;
        
        window.dbUpdate(perfilRef, { 
            listaImobiliarias: imobiliariasAtuais,
            imobiliariaId: idImob, // Mantemos o ID simples por precaução para não quebrar outras áreas            
        }).then(() => renderizarListasDoModal(idImob))
          .catch(e => alert("Erro ao incluir: " + e.message));
    });
};

window.desvincularCorretorDoGrupo = function(uid) {
    if(confirm("Deseja remover este membro do grupo? Ele perderá o acesso a esta imobiliária.")) {
        const idImob = document.getElementById('input-imob-id-atual').value;
        const perfilRef = window.dbRef(window.db, `usuarios/${uid}/perfil`);
        
        window.dbGet(perfilRef).then((snap) => {
            let dadosAtuais = snap.exists() ? snap.val() : {};
            let imobiliariasAtuais = dadosAtuais.listaImobiliarias || {};

            // Remove a imobiliária específica da lista
            delete imobiliariasAtuais[idImob];

            // Define o imobiliariaId para a primeira da lista que sobrou (se sobrar alguma), ou null
            const chavesRestantes = Object.keys(imobiliariasAtuais);
            const novoIdPrincipal = chavesRestantes.length > 0 ? chavesRestantes[0] : null;

            window.dbUpdate(perfilRef, {
                listaImobiliarias: imobiliariasAtuais,
                imobiliariaId: novoIdPrincipal
            }).then(() => renderizarListasDoModal(idImob))
              .catch(e => alert("Erro ao remover: " + e.message));
        });
    }
};

// ==========================================
// UTILITÁRIOS GLOBAIS (ORIGINAIS)
// ==========================================

function atualizarStatsGlobais(usuarios) {
    const total = Object.keys(usuarios).length;
    document.getElementById('master-total-users').innerText = total;
    const gestores = Object.values(usuarios).filter(u => u.perfil?.nivelAcesso === 'gestor').length;
    document.getElementById('master-total-gestores').innerText = gestores;
}

window.sincronizarEmails = async function() {
    const snapshot = await window.dbGet(window.dbRef(window.db, 'usuarios'));
    const dados = snapshot.val();
    for (const uid in dados) {
        if (dados[uid].email && !dados[uid].perfil?.email) {
            await window.dbUpdate(window.dbRef(window.db, `usuarios/${uid}/perfil`), { email: dados[uid].email });
        }
    }
    alert("Sincronizado!");
};

// ==========================================
// GESTÃO DE IMOBILIÁRIAS (CRIAÇÃO E EXCLUSÃO)
// ==========================================

window.abrirModalNovaImob = () => document.getElementById('modal-nova-imobiliaria').classList.add('show');

window.fecharModalNovaImob = () => {
    document.getElementById('modal-nova-imobiliaria').classList.remove('show');
    document.getElementById('imob-nome-input').value = '';
};

window.salvarImobiliaria = function() {
    const nome = document.getElementById('imob-nome-input').value;
    if(!nome) return alert("Insira o nome da imobiliária.");

    const idImob = `IMOB-${Date.now().toString().substring(7)}`;
    const imobRef = window.dbRef(window.db, `imobiliarias/${idImob}`);

    const novaImob = {
        id: idImob,
        nome: nome,
        dataCriacao: Date.now(),
        status: 'ativo'
    };

    window.dbSet(imobRef, novaImob).then(() => {
        alert("🏢 Imobiliária criada com sucesso!");
        fecharModalNovaImob();
        // CORREÇÃO 3: Nome da função corrigido para carregarDadosGlobais (plural)
        carregarDadosGlobais();
    }).catch(e => alert("Erro: " + e.message));
};

window.excluirImobiliaria = async function(idImob, nomeImob) {
    if(confirm(`ATENÇÃO: Deseja realmente excluir o grupo '${nomeImob}'? Membros associados a ela perderão o acesso.`)) {
        
        for(const uid in window.dadosGlobaisUsuarios) {
            const perfil = window.dadosGlobaisUsuarios[uid].perfil || {};
            
            // Verifica se o membro tem ligação a este grupo (pelo método antigo ou novo)
            if(perfil.imobiliariaId === idImob || (perfil.listaImobiliarias && perfil.listaImobiliarias[idImob])) {
                
                let imobAtuais = perfil.listaImobiliarias || {};
                delete imobAtuais[idImob]; // Apaga da lista

                const chavesRestantes = Object.keys(imobAtuais);
                const novoIdPrincipal = chavesRestantes.length > 0 ? chavesRestantes[0] : null;

                await window.dbUpdate(window.dbRef(window.db, `usuarios/${uid}/perfil`), {
                    listaImobiliarias: imobAtuais,
                    imobiliariaId: novoIdPrincipal
                });
            }
        }

        const imobRef = window.dbRef(window.db, `imobiliarias/${idImob}`);
        window.dbSet(imobRef, null).then(() => {
            alert("Grupo removido com sucesso!");
            carregarDadosGlobais();
        });
    }
};

// --- FUNÇÕES DA ABA SISTEMA ---

window.enviarAvisoGlobal = function() {
    const msg = document.getElementById('input-aviso-global').value;
    if(!msg) return alert("Digite uma mensagem.");
    
    if(confirm("Deseja enviar este aviso para todos os utilizadores?")) {
        window.dbUpdate(window.dbRef(window.db, 'configuracoes/sistema'), {
            avisoGlobal: msg,
            dataAviso: Date.now()
        }).then(() => {
            alert("Aviso enviado com sucesso!");
            document.getElementById('input-aviso-global').value = '';
        });
    }
};

// Função para filtrar a tabela principal de utilizadores no Admin Master
window.filtrarMasterGlobal = function() {
    const termo = document.getElementById('busca-master-global').value.toLowerCase();
    const linhas = document.querySelectorAll('#tabela-master-corpo tr');
    
    linhas.forEach(linha => {
        const textoParaBusca = linha.getAttribute('data-search') || "";
        // Se o texto escondido contiver o que foi digitado, mostra a linha. Senão, esconde.
        if (textoParaBusca.includes(termo)) {
            linha.style.display = '';
        } else {
            linha.style.display = 'none';
        }
    });
};

window.toggleManutencao = function() {
    const btn = document.getElementById('btn-manutencao');
    const emManutencao = btn.innerText.includes("Ativar");
    
    const acao = emManutencao ? "ATIVAR o Modo Manutenção" : "DESATIVAR o Modo Manutenção";
    
    if(confirm(`Deseja ${acao}?`)) {
        window.dbUpdate(window.dbRef(window.db, 'configuracoes/sistema'), {
            manutencao: emManutencao
        }).then(() => {
            btn.innerText = emManutencao ? "Desativar Bloqueio" : "Ativar Bloqueio";
            btn.style.background = emManutencao ? "#22c55e" : "#ef4444";
        });
    }
};

// Função para sincronizar a UI com o banco de dados ao abrir a aba Sistema
function carregarConfiguracoesSistema() {
    const sysRef = window.dbRef(window.db, 'configuracoes/sistema');
    window.dbGet(sysRef).then((snap) => {
        if(snap.exists()) {
            const config = snap.val();
            // Preenche o campo de aviso se houver um ativo
            if(config.avisoGlobal) {
                document.getElementById('input-aviso-global').value = config.avisoGlobal;
            }
            // Atualiza o botão de manutenção
            const btn = document.getElementById('btn-manutencao');
            if(config.manutencao === true) {
                btn.innerText = "Desativar Bloqueio";
                btn.style.background = "#22c55e";
            } else {
                btn.innerText = "Ativar Bloqueio";
                btn.style.background = "#ef4444";
            }
        }
    });
}