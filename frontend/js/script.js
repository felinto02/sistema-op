// ============================================
// CONFIGURAÇÕES GLOBAIS
// ============================================

let API_URL;

if (window.location.protocol === 'file:' || 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1') {
    API_URL = "http://localhost:3000";
    console.log('🔧 Modo DESENVOLVIMENTO detectado');
} else {
    API_URL = window.location.origin;
    console.log('🌐 Modo PRODUÇÃO detectado');
}

let documentosAnexados = [];
let timeoutBusca;

console.log('='.repeat(60));
console.log('🚀 SISTEMA DE CADASTRO INICIADO');
console.log('📡 API URL:', API_URL);
console.log('⏰ Data/Hora:', new Date().toLocaleString('pt-BR'));
console.log('='.repeat(60));

// ============================================
// FUNÇÃO NOVO CADASTRO
// ============================================

function novoCadastro() {
    Swal.fire({
        title: 'Novo Cadastro',
        text: 'Deseja limpar todos os campos e criar um novo cadastro?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sim, novo cadastro',
        cancelButtonText: 'Cancelar',
        background: '#1a1a2e',
        color: '#fff'
    }).then((result) => {
        if (result.isConfirmed) {
            limparFormulario();
            
            Swal.fire({
                icon: 'success',
                title: 'Formulário Limpo',
                text: 'Pronto para novo cadastro',
                toast: true,
                position: 'top-end',
                timer: 2000,
                timerProgressBar: true,
                showConfirmButton: false,
                background: '#1a1a2e',
                color: '#fff'
            });
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
}

function limparFormulario() {
    const form = document.getElementById('formCadastro');
    
    form.dataset.modo = 'create';
    delete form.dataset.idEdicao;
    
    document.getElementById('btnAcao').innerHTML = '<i class="fas fa-save"></i> SALVAR REGISTRO OPERACIONAL';
    document.getElementById('btnAcao').style.background = "linear-gradient(135deg, #28a745, #20c997)";
    
    form.reset();
    
    // Limpar galeria de fotos do alvo
    ['prev1', 'prev2', 'prev3'].forEach((id) => {
        const img = document.getElementById(id);
        const container = img.parentElement;
        img.src = '';
        img.style.display = 'none';
        container.classList.remove('has-image');
        const fileInput = container.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';
    });
    
    // Limpar fotos do local (NOVO)
    ['prev_local1', 'prev_local2'].forEach((id) => {
        const img = document.getElementById(id);
        const container = img.parentElement;
        img.src = '';
        img.style.display = 'none';
        container.classList.remove('has-image');
        const fileInput = container.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';
    });
        
    document.getElementById('naturalidade').innerHTML = '<option value="">Selecione o Estado primeiro</option>';
    document.getElementById('cidade').innerHTML = '<option value="">Selecione o Estado primeiro</option>';
    
    documentosAnexados = [];
    renderizarDocumentos();
}

// ============================================
// FUNÇÕES DE FORMATAÇÃO (NOMES PRESERVADOS)
// ============================================

function formatarNome(texto) {
    if (!texto) return '';
    const preposicoes = ['de', 'do', 'da', 'dos', 'das', 'e', 'a', 'o', 'as', 'os'];
    const textoLimpo = texto.trim().replace(/\s+/g, ' ');
    
    return textoLimpo.toLowerCase().split(' ').map((palavra, index) => {
        if (index === 0) return palavra.charAt(0).toUpperCase() + palavra.slice(1);
        if (preposicoes.includes(palavra)) return palavra;
        return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    }).join(' ');
}

function formatarNomeCompleto(texto) {
    if (!texto) return '';
    return texto.toUpperCase().trim().replace(/\s+/g, ' ');
}

function formatarFrase(texto) {
    if (!texto) return '';
    const limpo = texto.trim().replace(/\s+/g, ' ').toLowerCase();
    return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

function aplicarFormatacaoTempoReal(input, tipoFormatacao) {
    const cursorPos = input.selectionStart;
    const valorAtual = input.value;
    if (!valorAtual) return;
    
    let novoTexto = '';
    
    switch(tipoFormatacao) {
        case 'all':
            // Sempre maiúsculo (CPF, RG, etc.)
            novoTexto = valorAtual.toUpperCase();
            break;
            
        case 'name':
            // Nomes próprios: formatação inteligente
            novoTexto = formatarNomePreservandoEspacos(valorAtual);
            break;
            
        case 'text':
            // Textos/frases: respeitar CapsLock e Shift
            novoTexto = formatarTextoRespeitandoCapsLock(valorAtual);
            break;
            
        default:
            novoTexto = valorAtual;
    }
    
    // Só atualiza se houver mudança real
    if (novoTexto !== valorAtual) {
        input.value = novoTexto;
        // Mantém o cursor na posição correta
        let novoCursorPos = Math.min(cursorPos, novoTexto.length);
        input.setSelectionRange(novoCursorPos, novoCursorPos);
    }
}

// NOVA FUNÇÃO: Formatação de texto respeitando CapsLock
function formatarTextoRespeitandoCapsLock(texto) {
    if (!texto) return '';
    
    // Detecta se o usuário provavelmente está com CapsLock ativo:
    // - Texto tem mais de 1 caractere
    // - Todo o texto está em maiúsculo
    // - E não é igual ao original em minúsculo (evita falsos positivos)
    const soMaiusculas = texto.length > 1 && 
                        texto === texto.toUpperCase() && 
                        texto !== texto.toLowerCase();
    
    if (soMaiusculas) {
        // CapsLock provavelmente ativo: mantém o texto como o usuário digitou
        return texto;
    }
    
    // Formatação normal: primeira letra maiúscula, resto como está
    // (não força minúsculo para respeitar Shift momentâneo)
    if (texto.length > 0) {
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }
    
    return texto;
}

function formatarNomePreservandoEspacos(texto) {
    if (!texto) return '';
    const preposicoes = ['de', 'do', 'da', 'dos', 'das', 'e', 'a', 'o', 'as', 'os'];
    const palavras = texto.split(' ');
    
    const palavrasFormatadas = palavras.map((palavra, index) => {
        if (palavra === '') return '';
        const palavraLower = palavra.toLowerCase();
        if (index === 0) return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
        if (preposicoes.includes(palavraLower)) return palavraLower;
        return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
    });
    
    return palavrasFormatadas.join(' ');
}

// ============================================
// CARREGAMENTO DE DADOS
// ============================================

async function carregarEstados() {
    try {
        const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
        const estados = await res.json();
        
        const selects = ['uf_natural', 'uf_endereco'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            estados.forEach(estado => {
                const option = document.createElement('option');
                option.value = estado.sigla;
                option.textContent = `${estado.sigla} - ${estado.nome}`;
                select.appendChild(option);
            });
        });
    } catch (err) {
        console.error('Erro ao carregar estados:', err);
    }
}

async function carregarCidadesNaturalidade() {
    const uf = document.getElementById('uf_natural').value;
    const cidadeSelect = document.getElementById('naturalidade');
    cidadeSelect.innerHTML = '<option value="">Carregando...</option>';
    
    if (!uf) {
        cidadeSelect.innerHTML = '<option value="">Selecione o Estado primeiro</option>';
        return;
    }
    
    try {
        const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
        const cidades = await res.json();
        cidadeSelect.innerHTML = '<option value="">Selecione a Cidade</option>';
        cidades.forEach(cidade => {
            const option = document.createElement('option');
            option.value = cidade.nome;
            option.textContent = cidade.nome;
            cidadeSelect.appendChild(option);
        });
    } catch (err) {
        console.error('Erro ao carregar cidades:', err);
        cidadeSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

async function carregarCidadesEndereco() {
    const uf = document.getElementById('uf_endereco').value;
    const cidadeSelect = document.getElementById('cidade');
    cidadeSelect.innerHTML = '<option value="">Carregando...</option>';
    
    if (!uf) {
        cidadeSelect.innerHTML = '<option value="">Selecione o Estado primeiro</option>';
        return;
    }
    
    try {
        const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
        const cidades = await res.json();
        cidadeSelect.innerHTML = '<option value="">Selecione a Cidade</option>';
        cidades.forEach(cidade => {
            const option = document.createElement('option');
            option.value = cidade.nome;
            option.textContent = cidade.nome;
            cidadeSelect.appendChild(option);
        });
    } catch (err) {
        console.error('Erro ao carregar cidades:', err);
        cidadeSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

// ============================================
// PREVIEW E DOCUMENTOS
// ============================================

// Preview de imagem (atualizado com botão remover)
function previewImg(input, imgId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.getElementById(imgId);
            const container = img.parentElement;
            // Suporta tanto .btn-remove-photo (fotos do alvo) quanto .remove-photo (fotos do local)
            const removeBtn = container.querySelector('.btn-remove-photo, .remove-photo');
            
            img.src = e.target.result;
            img.style.display = 'block';
            container.classList.add('has-image');
            if (removeBtn) removeBtn.style.display = 'flex';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Remover foto selecionada
function removePhoto(imgId) {
    const img = document.getElementById(imgId);
    const container = img.parentElement;
    // Suporta tanto .btn-remove-photo (fotos do alvo) quanto .remove-photo (fotos do local)
    const removeBtn = container.querySelector('.btn-remove-photo, .remove-photo');
    
    img.src = '';
    img.style.display = 'none';
    container.classList.remove('has-image');
    if (removeBtn) removeBtn.style.display = 'none';
    
    const fileInput = container.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
}

function adicionarDocumento(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        Swal.fire({
            icon: 'warning',
            title: 'Arquivo muito grande',
            text: 'O arquivo deve ter no máximo 10MB',
            background: '#1a1a2e',
            color: '#fff'
        });
        input.value = '';
        return;
    }

    const tipo = document.getElementById('tipo-documento').value;
    const descricao = document.getElementById('descricao-documento').value || file.name;

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result.split(',')[1];
        documentosAnexados.push({
            tipo: tipo,
            nome_arquivo: file.name,
            descricao: formatarFrase(descricao),
            arquivo_base64: base64,
            mime_type: file.type
        });
        renderizarDocumentos();
        document.getElementById('descricao-documento').value = '';
        input.value = '';
        
        Swal.fire({
            icon: 'success',
            title: 'Documento Adicionado',
            toast: true,
            position: 'top-end',
            timer: 2000,
            timerProgressBar: true,
            showConfirmButton: false,
            background: '#1a1a2e',
            color: '#fff'
        });
    };
    reader.readAsDataURL(file);
}

function renderizarDocumentos() {
    const lista = document.getElementById('lista-documentos');
    const counter = document.getElementById('docs-counter');
    counter.textContent = documentosAnexados.length;
    
    if (documentosAnexados.length === 0) {
        lista.innerHTML = '<div class="empty-docs"><i class="fas fa-file-upload"></i><p>Nenhum documento anexado ainda</p></div>';
        return;
    }

    const tipoLabel = {
        'mandado': 'Mandado Judicial',
        'boletim': 'Boletim de Ocorrência',
        'relatorio': 'Relatório',
        'oficio': 'Ofício',
        'foto_investigacao': 'Foto de Investigação',
        'outro': 'Outro Documento'
    };

    lista.innerHTML = documentosAnexados.map((doc, index) => {
        const icone = doc.mime_type.includes('pdf') ? 'fa-file-pdf' : 'fa-image';
        const tamanhoKB = (doc.arquivo_base64.length * 0.75 / 1024).toFixed(1);
        return `
            <div class="doc-item">
                <div class="doc-info">
                    <h4><i class="fas ${icone}"></i> ${tipoLabel[doc.tipo]}<span class="doc-badge">${tamanhoKB} KB</span></h4>
                    <p><i class="fas fa-file"></i> ${doc.descricao}</p>
                </div>
                <button type="button" class="btn-remove-doc" onclick="removerDocumento(${index})">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
    }).join('');
}

function removerDocumento(index) {
    Swal.fire({
        title: 'Remover Documento?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        confirmButtonText: 'Sim, remover',
        cancelButtonText: 'Cancelar',
        background: '#1a1a2e',
        color: '#fff'
    }).then((result) => {
        if (result.isConfirmed) {
            documentosAnexados.splice(index, 1);
            renderizarDocumentos();
            
            Swal.fire({
                icon: 'success',
                title: 'Removido',
                toast: true,
                position: 'top-end',
                timer: 2000,
                timerProgressBar: true,
                showConfirmButton: false,
                background: '#1a1a2e',
                color: '#fff'
            });
        }
    });
}

// ============================================
// SUBMIT DO FORMULÁRIO
// ============================================

document.getElementById('formCadastro').onsubmit = async (e) => {
    e.preventDefault();
    
    Swal.fire({ 
        title: 'Processando...', 
        html: `<p>Salvando dados e ${documentosAnexados.length} documento(s)...</p>`,
        allowOutsideClick: false, 
        didOpen: () => Swal.showLoading() 
    });

    const form = e.target;
    const formData = new FormData(form);
    const rawData = Object.fromEntries(formData.entries());

    // Formatação dos campos (NOMES PRESERVADOS)
    rawData.nome = formatarNomeCompleto(rawData.nome);
    rawData.mae = formatarNome(rawData.mae);
    rawData.pai = formatarNome(rawData.pai);
    rawData.rua = formatarNome(rawData.rua);
    rawData.bairro = formatarNome(rawData.bairro);
    rawData.complemento = formatarFrase(rawData.complemento);
    rawData.obs_tacticas = formatarFrase(rawData.obs_tacticas);
    rawData.envolvimento_alvo = formatarFrase(rawData.envolvimento_alvo);
    rawData.detalhes_operacao = formatarFrase(rawData.detalhes_operacao);
    
    rawData.modo = form.dataset.modo;
    rawData.idEdicao = form.dataset.idEdicao;

    // Converter imagens para base64
    const getB64 = (id) => {
        const src = document.getElementById(id).src;
        return src && src.includes('base64') ? src.split(',')[1] : null;
    };
    
    // Fotos do alvo
    rawData.foto1 = getB64('prev1');
    rawData.foto2 = getB64('prev2');
    rawData.foto3 = getB64('prev3');
    
    // Fotos do local (NOVO)
    rawData.foto_local1 = getB64('prev_local1');
    rawData.foto_local2 = getB64('prev_local2');
    
    rawData.documentos = documentosAnexados;

    try {
        const res = await fetch(`${API_URL}/cadastrar-alvo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rawData)
        });
        const data = await res.json();
        
        if (data.success) {
            Swal.fire({
                icon: 'success',
                title: data.message || 'Operação realizada com sucesso',
                toast: true,
                position: 'top-end',
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: false,
                background: '#1a1a2e',
                color: '#fff'
            });
            limparFormulario();
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: data.error || 'Erro ao salvar',
                background: '#1a1a2e',
                color: '#fff'
            });
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Falha na conexão com servidor.',
            background: '#1a1a2e',
            color: '#fff'
        });
    }
};

// ============================================
// MODAL DE GERENCIAMENTO
// ============================================

function abrirModalGerenciar() {
    document.getElementById('modal-gerenciar').style.display = 'flex';
    document.getElementById('input-busca').value = '';
    document.getElementById('lista-resultados').innerHTML = '';
    document.getElementById('input-busca').focus();
}

function fecharModalGerenciar() {
    document.getElementById('modal-gerenciar').style.display = 'none';
    document.getElementById('input-busca').value = '';
    document.getElementById('lista-resultados').innerHTML = '';
}

// ============================================
// BUSCA DE ALVOS
// ============================================

document.getElementById('input-busca').addEventListener('input', async function(e) {
    clearTimeout(timeoutBusca);
    const termo = e.target.value.trim();
    const lista = document.getElementById('lista-resultados');
    
    if (termo.length < 2) {
        lista.innerHTML = termo.length === 0 ? '' : '<p style="text-align:center; color:#999; padding:20px;">Digite pelo menos 2 caracteres</p>';
        return;
    }

    lista.innerHTML = '<p style="text-align:center; color:#ffd700; padding:20px;"><i class="fas fa-spinner fa-spin"></i> Buscando...</p>';

    timeoutBusca = setTimeout(async () => {
        try {
            const res = await fetch(`${API_URL}/buscar-alvos?termo=${encodeURIComponent(termo)}`);
            
            if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);
            
            const alvos = await res.json();
            console.log('📋 Resultados da busca:', alvos);
            
            if (!alvos || alvos.length === 0) {
                lista.innerHTML = `
                    <div style="text-align:center; padding:30px; color:#999;">
                        <i class="fas fa-search" style="font-size:48px; margin-bottom:15px; opacity:0.3;"></i>
                        <p style="font-size:16px;">Nenhum resultado encontrado para "<strong>${termo}</strong>"</p>
                    </div>
                `;
                return;
            }
            
            lista.innerHTML = alvos.map(alvo => `
                <div class="result-item">
                    <div class="result-info">
                        <strong>${alvo.nome || 'Nome não informado'}</strong>
                        <small>CPF: ${alvo.cpf || 'Não informado'} | ID: ${alvo.id}</small>
                    </div>
                    <div class="result-actions">
                        <button class="btn-action btn-edit" onclick="carregarAlvo(${alvo.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action btn-qr" onclick="visualizarQR(${alvo.id})" title="QR Code">
                            <i class="fas fa-qrcode"></i>
                        </button>
                        <button class="btn-action btn-delete" onclick="excluirAlvo(${alvo.id}, '${(alvo.nome || '').replace(/'/g, "\\'")}')" title="Excluir">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `).join('');
            
        } catch (err) {
            console.error('❌ Erro na busca:', err);
            lista.innerHTML = `
                <div style="text-align:center; padding:20px; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle" style="font-size:32px; margin-bottom:10px;"></i>
                    <p><strong>Erro ao buscar dados</strong></p>
                    <small>${err.message}</small>
                </div>
            `;
        }
    }, 500);
});

// ============================================
// CARREGAR ALVO PARA EDIÇÃO
// ============================================

async function carregarAlvo(id) {
    fecharModalGerenciar();
    Swal.fire({ 
        title: 'Carregando...', 
        allowOutsideClick: false, 
        didOpen: () => Swal.showLoading() 
    });
    
    try {
        const res = await fetch(`${API_URL}/buscar-detalhes/${id}`);

        // Fecha o loading antes de qualquer processamento
        Swal.close();

        if (!res.ok) {
            throw new Error(`Servidor retornou erro ${res.status}`);
        }

        const data = await res.json();
        
        if (data && data.id) {
            const form = document.getElementById('formCadastro');
            form.dataset.modo = 'edicao';
            form.dataset.idEdicao = data.id;
            document.getElementById('btnAcao').innerHTML = `<i class="fas fa-edit"></i> ATUALIZAR REGISTRO ID: ${data.id}`;
            document.getElementById('btnAcao').style.background = "linear-gradient(135deg, #ff8c00, #ff6b00)";
            
            // Preencher campos básicos
            Object.keys(data).forEach(key => {
                const input = form.querySelector(`[name="${key}"]`);
                if (input && key !== 'data_nascimento') input.value = data[key] || '';
            });

            // Data de nascimento
            if (data.data_nascimento) {
                form.querySelector('[name="data_nascimento"]').value = data.data_nascimento.split('T')[0];
            }

            // UF e cidade de naturalidade
            if (data.uf_natural) {
                document.getElementById('uf_natural').value = data.uf_natural;
                await carregarCidadesNaturalidade();
                setTimeout(() => {
                    if (data.naturalidade) document.getElementById('naturalidade').value = data.naturalidade;
                }, 500);
            }

            // UF e cidade de endereço
            if (data.uf_endereco) {
                document.getElementById('uf_endereco').value = data.uf_endereco;
                await carregarCidadesEndereco();
                setTimeout(() => {
                    if (data.cidade) document.getElementById('cidade').value = data.cidade;
                }, 500);
            }

            // Carregar fotos do alvo
            ['foto1', 'foto2', 'foto3'].forEach((foto, i) => {
                if (data[foto]) {
                    const img = document.getElementById(`prev${i+1}`);
                    img.src = 'data:image/jpeg;base64,' + data[foto];
                    img.style.display = 'block';
                    img.parentElement.classList.add('has-image');
                    const removeBtn = img.parentElement.querySelector('.btn-remove-photo, .remove-photo');
                    if (removeBtn) removeBtn.style.display = 'flex';
                }
            });

            // Carregar fotos do local
            ['foto_local1', 'foto_local2'].forEach((foto, index) => {
                if (data[foto]) {
                    const img = document.getElementById(`prev_local${index+1}`);
                    img.src = 'data:image/jpeg;base64,' + data[foto];
                    img.style.display = 'block';
                    img.parentElement.classList.add('has-image');
                    const removeBtn = img.parentElement.querySelector('.btn-remove-photo, .remove-photo');
                    if (removeBtn) removeBtn.style.display = 'flex';
                }
            });

            // Carregar documentos
            documentosAnexados = [];
            if (data.documentos && data.documentos.length > 0) {
                documentosAnexados = data.documentos.map(doc => ({
                    tipo: doc.tipo_documento,
                    nome_arquivo: doc.nome_arquivo,
                    descricao: doc.descricao,
                    arquivo_base64: doc.arquivo_base64,
                    mime_type: doc.mime_type
                }));
                renderizarDocumentos();
            }

            // Delay para evitar piscar entre modais
            setTimeout(() => {
                Swal.fire({
                    icon: 'info', 
                    title: 'Modo Edição', 
                    text: `Dados do ID ${data.id} carregados`,
                    timer: 3000,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    background: '#1a1a2e',
                    color: '#fff'
                });
            }, 300);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            setTimeout(() => {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: data.error || 'Registro não encontrado.',
                    background: '#1a1a2e',
                    color: '#fff'
                });
            }, 300);
        }
    } catch (err) {
        setTimeout(() => {
            Swal.fire({
                icon: 'error',
                title: 'Erro ao carregar',
                text: err.message || 'Falha na conexão com o servidor.',
                background: '#1a1a2e',
                color: '#fff'
            });
        }, 300);
    }
}

// ============================================
// QR CODE
// ============================================

async function visualizarQR(id) {
    fecharModalGerenciar();
    
    setTimeout(async () => {
        try {
            const res = await fetch(`${API_URL}/buscar-detalhes/${id}`);
            const data = await res.json();
            
            if (data && data.id) {
                Swal.fire({
                    title: `QR Code - ID ${data.id}`,
                    html: `
                        <div style="background: white; padding: 20px; border-radius: 10px; display: inline-block; margin: 20px 0;">
                            <div id="qrcode-render"></div> 
                        </div>
                        <p style="margin-top: 15px; color: #ffd700; font-weight: bold; font-size: 18px;">${data.nome}</p>
                        <p style="color: #ccc;">Escaneie para abrir o perfil</p>
                    `,
                    width: 500,
                    background: '#1a1a2e',
                    color: '#fff',
                    showDenyButton: true,
                    confirmButtonText: '<i class="fas fa-check"></i> OK',
                    denyButtonText: '<i class="fas fa-download"></i> Baixar QR Code',
                    denyButtonColor: '#27ae60',
                    confirmButtonColor: '#3498db',
                    didOpen: () => {
                        const elementoQR = document.getElementById("qrcode-render");
                        const qrLink = `${window.location.origin}/home.html?id=${data.id}`;
                        
                        new QRCode(elementoQR, {
                            text: qrLink,
                            width: 256,
                            height: 256,
                            colorDark: "#000000",
                            colorLight: "#ffffff",
                            correctLevel: QRCode.CorrectLevel.H
                        });
                    }
                }).then((result) => {
                    if (result.isDenied) {
                        baixarQRCode(data.nome, data.id);
                    }
                });
            }
        } catch (error) {
            console.error('Erro ao visualizar QR:', error);
            Swal.fire({ icon: 'error', title: 'Erro', text: 'Falha ao gerar QR Code', background: '#1a1a2e', color: '#fff' });
        }
    }, 100);
}

function baixarQRCode(nomeAlvo, idAlvo) {
    try {
        const qrContainer = document.getElementById("qrcode-render");
        const canvas = qrContainer?.querySelector('canvas');
        
        if (!canvas) {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: 'QR Code não encontrado',
                background: '#1a1a2e',
                color: '#fff'
            });
            return;
        }

        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const nomeArquivo = `QRCode_${nomeAlvo.replace(/\s+/g, '_')}_ID${idAlvo}.png`;
            
            link.href = url;
            link.download = nomeArquivo;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            Swal.fire({
                icon: 'success',
                title: 'Download Iniciado',
                text: `Arquivo: ${nomeArquivo}`,
                toast: true,
                position: 'top-end',
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: false,
                background: '#1a1a2e',
                color: '#fff'
            });
        }, 'image/png');
    } catch (error) {
        console.error('Erro ao baixar QR Code:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Falha ao gerar arquivo PNG',
            background: '#1a1a2e',
            color: '#fff'
        });
    }
}

// ============================================
// EXCLUIR ALVO
// ============================================

async function excluirAlvo(id, nome) {
    fecharModalGerenciar();
    
    setTimeout(async () => {
        const result = await Swal.fire({
            title: 'Confirmar Exclusão',
            html: `Deseja realmente excluir:<br><strong style="color: #ffd700;">${nome}</strong><br>ID: ${id}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e74c3c',
            confirmButtonText: 'Sim, excluir',
            cancelButtonText: 'Cancelar',
            background: '#1a1a2e',
            color: '#fff'
        });

        if (result.isConfirmed) {
            try {
                const res = await fetch(`${API_URL}/deletar-alvo/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (data.success) {
                    Swal.fire({ 
                        icon: 'success', 
                        title: 'Excluído com sucesso',
                        toast: true,
                        position: 'top-end',
                        timer: 2000,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        background: '#1a1a2e', 
                        color: '#fff' 
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Erro',
                        text: data.error || 'Erro ao excluir',
                        background: '#1a1a2e',
                        color: '#fff'
                    });
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Falha na conexão',
                    background: '#1a1a2e',
                    color: '#fff'
                });
            }
        }
    }, 100);
}

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM Carregado - Inicializando sistema...');
    
    // Carrega estados
    carregarEstados();
    
    // Aplica máscara de CPF
    const cpfInput = document.getElementById("cpf");
    if (cpfInput) {
        VMasker(cpfInput).maskPattern("999.999.999-99");
    }
    
    // Formatação: campos MAIÚSCULOS (CPF, RG)
    document.querySelectorAll('.capitalize-all').forEach(input => {
        input.addEventListener('input', function() { 
            aplicarFormatacaoTempoReal(this, 'all'); 
        });
        input.addEventListener('blur', function() { 
            this.value = formatarNomeCompleto(this.value); 
        });
    });
    
    // Formatação: Nomes próprios (Primeira letra maiúscula) - PRESERVADO ✅
    document.querySelectorAll('.capitalize-name').forEach(input => {
        input.addEventListener('input', function() { 
            aplicarFormatacaoTempoReal(this, 'name'); 
        });
        input.addEventListener('blur', function() { 
            this.value = formatarNome(this.value); 
        });
    });

    // Formatação: Textos/frases (Primeira letra maiúscula)
    document.querySelectorAll('.capitalize-text').forEach(input => {
        input.addEventListener('input', function() { 
            aplicarFormatacaoTempoReal(this, 'text'); 
        });
        input.addEventListener('blur', function() { 
            this.value = formatarFrase(this.value); 
        });
    });
    
    console.log('✅ Sistema inicializado com sucesso!');

    // ============================================
    // DRAG AND DROP - ÁREA DE LISTA DE DOCUMENTOS
    // ============================================
    const dropArea = document.getElementById('lista-documentos');

    ['dragenter', 'dragover'].forEach(event => {
        dropArea.addEventListener(event, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropArea.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(event => {
        dropArea.addEventListener(event, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropArea.classList.remove('drag-over');
        });
    });

    dropArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            // Valida tipo
            if (!file.type.includes('pdf') && !file.type.includes('image')) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Tipo não suportado',
                    text: `"${file.name}" não é PDF ou imagem.`,
                    toast: true,
                    position: 'top-end',
                    timer: 3000,
                    showConfirmButton: false,
                    background: '#1a1a2e',
                    color: '#fff'
                });
                return;
            }

            // Valida tamanho (10MB)
            if (file.size > 10 * 1024 * 1024) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Arquivo muito grande',
                    text: `"${file.name}" ultrapassa 10MB.`,
                    toast: true,
                    position: 'top-end',
                    timer: 3000,
                    showConfirmButton: false,
                    background: '#1a1a2e',
                    color: '#fff'
                });
                return;
            }

            const tipo = document.getElementById('tipo-documento').value;
            const descricao = document.getElementById('descricao-documento').value || file.name;

            const reader = new FileReader();
            reader.onload = function(ev) {
                const base64 = ev.target.result.split(',')[1];
                documentosAnexados.push({
                    tipo: tipo,
                    nome_arquivo: file.name,
                    descricao: formatarFrase(descricao),
                    arquivo_base64: base64,
                    mime_type: file.type
                });
                renderizarDocumentos();
                document.getElementById('descricao-documento').value = '';

                Swal.fire({
                    icon: 'success',
                    title: 'Documento Adicionado',
                    text: file.name,
                    toast: true,
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false,
                    background: '#1a1a2e',
                    color: '#fff'
                });
            };
            reader.readAsDataURL(file);
        });
    });
});

// Validação de CPF
document.getElementById('cpf')?.addEventListener('blur', function() {
    const cpf = this.value.replace(/\D/g, '');
    if (cpf.length > 0 && cpf.length !== 11) {
        Swal.fire({
            icon: 'warning',
            title: 'CPF Inválido',
            text: 'O CPF deve conter 11 dígitos',
            toast: true,
            position: 'top-end',
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false,
            background: '#1a1a2e',
            color: '#fff'
        });
    }
});

// Fechar modal com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        fecharModalGerenciar();
    }
});

// Renderiza documentos inicialmente
renderizarDocumentos();

console.log('🎯 Script carregado completamente!');