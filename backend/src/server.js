const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();

// ============================================
// CONFIGURAÇÕES DE MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));
app.use(express.static(path.join(__dirname, '../../frontend')));

// ============================================
// VERIFICAÇÃO DE CONEXÃO COM BANCO
// ============================================
const verificarConexaoDB = async () => {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('✅ BANCO DE DADOS CONECTADO EM:', res.rows[0].now);
    } catch (err) {
        console.error('❌ ERRO AO CONECTAR NO BANCO:', err.message);
    }
};

// ============================================
// CRIAR TABELA DE DOCUMENTOS
// ============================================
const criarTabelaDocumentos = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS documentos_alvo (
                id SERIAL PRIMARY KEY,
                alvo_id INTEGER REFERENCES alvos(id) ON DELETE CASCADE,
                tipo_documento VARCHAR(50),
                nome_arquivo VARCHAR(255) NOT NULL,
                descricao TEXT,
                arquivo_base64 TEXT NOT NULL,
                mime_type VARCHAR(100),
                data_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Tabela documentos_alvo verificada/criada');
    } catch (err) {
        console.error('❌ Erro ao criar tabela de documentos:', err.message);
    }
};

// Inicialização
verificarConexaoDB();
criarTabelaDocumentos();

// ============================================
// FUNÇÕES AUXILIARES (LÓGICA ORIGINAL PRESERVADA)
// ============================================

const atualizarAlvo = async (client, dados, idEdicao) => {
    const { nome, cpf, rg, data_nascimento, naturalidade, uf_natural, mae, pai } = dados;
    
    await client.query(
        `UPDATE alvos SET 
            nome=$1, cpf=$2, rg=$3, data_nascimento=$4, naturalidade=$5, 
            uf_natural=$6, mae=$7, pai=$8 
         WHERE id=$9`,
        [nome, cpf, rg, data_nascimento || null, naturalidade, uf_natural, mae, pai, idEdicao]
    );

    await client.query(
        `UPDATE alvo_enderecos SET 
            rua=$1, numero=$2, bairro=$3, cidade=$4, uf_endereco=$5, link_mapa=$6, 
            ponto_referencia=$7, observacoes_tacticas=$8 
         WHERE alvo_id=$9`,
        [dados.rua, dados.numero, dados.bairro, dados.cidade, dados.uf_endereco, 
         dados.link_mapa, dados.complemento, dados.obs_tacticas, idEdicao]
    );

    await client.query(
        `UPDATE alvo_fotos SET 
            foto1=COALESCE($1, foto1), foto2=COALESCE($2, foto2), foto3=COALESCE($3, foto3) 
         WHERE alvo_id=$4`,
        [dados.foto1, dados.foto2, dados.foto3, idEdicao]
    );

    await client.query(
        `UPDATE alvo_inteligencia SET 
            envolvimento_alvo=$1, detalhes_operacao=$2
         WHERE alvo_id=$3`,
        [dados.envolvimento_alvo, dados.detalhes_operacao, idEdicao]
    );

    // Na edição, se novos documentos forem enviados, limpamos os antigos e inserimos os novos
    if (dados.documentos && dados.documentos.length > 0) {
        await client.query('DELETE FROM documentos_alvo WHERE alvo_id = $1', [idEdicao]);
    }

    return idEdicao;
};

const criarNovoAlvo = async (client, dados) => {
    const { nome, cpf, rg, data_nascimento, naturalidade, uf_natural, mae, pai } = dados;
    
    const resAlvo = await client.query(
        `INSERT INTO alvos (nome, cpf, rg, data_nascimento, naturalidade, uf_natural, mae, pai) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [nome, cpf, rg, data_nascimento || null, naturalidade, uf_natural, mae, pai]
    );
    
    const alvoId = resAlvo.rows[0].id;

    await client.query(
        `INSERT INTO alvo_enderecos (alvo_id, rua, numero, bairro, cidade, uf_endereco, link_mapa, ponto_referencia, observacoes_tacticas) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [alvoId, dados.rua, dados.numero, dados.bairro, dados.cidade, dados.uf_endereco, 
         dados.link_mapa, dados.complemento, dados.obs_tacticas]
    );

    await client.query(
        `INSERT INTO alvo_fotos (alvo_id, foto1, foto2, foto3) VALUES ($1, $2, $3, $4)`,
        [alvoId, dados.foto1, dados.foto2, dados.foto3]
    );

    await client.query(
        `INSERT INTO alvo_inteligencia (alvo_id, envolvimento_alvo, detalhes_operacao) 
         VALUES ($1, $2, $3)`,
        [alvoId, dados.envolvimento_alvo, dados.detalhes_operacao]
    );

    return alvoId;
};

/**
 * SALVAR DOCUMENTOS (Vindo do cadastro.html)
 */
const salvarDocumentos = async (client, alvoId, documentos) => {
    if (!documentos || !Array.isArray(documentos) || documentos.length === 0) {
        return 0;
    }

    for (const doc of documentos) {
        await client.query(
            `INSERT INTO documentos_alvo 
                (alvo_id, tipo_documento, nome_arquivo, descricao, arquivo_base64, mime_type) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                alvoId, 
                doc.tipo || 'Documento', 
                doc.nome_arquivo || doc.nome, // Suporte aos dois nomes vindos do front
                doc.descricao || null, 
                doc.arquivo_base64 || doc.base64,
                doc.mime_type || 'application/octet-stream'
            ]
        );
    }
    return documentos.length;
};

// ============================================
// ROTAS
// ============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

app.post('/cadastrar-alvo', async (req, res) => {
    const client = await pool.connect();
    const { modo, idEdicao, documentos } = req.body;

    try {
        await client.query('BEGIN');

        let alvoId;
        if (modo === 'edicao' && idEdicao) {
            alvoId = await atualizarAlvo(client, req.body, idEdicao);
        } else {
            alvoId = await criarNovoAlvo(client, req.body);
        }

        const documentosSalvos = await salvarDocumentos(client, alvoId, documentos);

        await client.query('COMMIT');
        
        res.status(200).json({ 
            success: true, 
            id: alvoId, 
            message: modo === 'edicao' ? "Registro atualizado com sucesso" : "Cadastro realizado com sucesso",
            documentos_salvos: documentosSalvos
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERRO NA TRANSAÇÃO:", err.message);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

app.get('/buscar-alvos', async (req, res) => {
    const { nome } = req.query;
    if (!nome || nome.trim().length < 2) return res.json([]);
    
    try {
        const cpfLimpo = nome.replace(/\D/g, '');
        const result = await pool.query(
            `SELECT id, nome, cpf FROM alvos 
             WHERE nome ILIKE $1 OR REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') LIKE $2
             ORDER BY nome LIMIT 20`,
            [`%${nome}%`, `%${cpfLimpo}%`]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar alvos" });
    }
});

app.get('/buscar-detalhes/:id', async (req, res) => {
    try {
        const queryPrincipal = `
            SELECT a.*, e.rua, e.numero, e.bairro, e.cidade, e.uf_endereco, e.link_mapa, 
                   e.ponto_referencia as complemento, e.observacoes_tacticas as obs_tacticas,
                   i.envolvimento_alvo, i.detalhes_operacao,
                   f.foto1, f.foto2, f.foto3
            FROM alvos a
            LEFT JOIN alvo_enderecos e ON a.id = e.alvo_id
            LEFT JOIN alvo_inteligencia i ON a.id = i.alvo_id
            LEFT JOIN alvo_fotos f ON a.id = f.alvo_id
            WHERE a.id = $1`;
        
        const resultPrincipal = await pool.query(queryPrincipal, [req.params.id]);
        if (resultPrincipal.rows.length === 0) return res.status(404).json({ error: "Não encontrado" });

        const alvo = resultPrincipal.rows[0];
        
        // Busca documentos associados
        const resultDocs = await pool.query(
            `SELECT id, tipo_documento, nome_arquivo, descricao, arquivo_base64, mime_type, data_upload 
             FROM documentos_alvo WHERE alvo_id = $1`, [req.params.id]
        );
        alvo.documentos = resultDocs.rows;

        res.json(alvo);
    } catch (err) {
        res.status(500).json({ error: "Erro interno ao buscar detalhes" });
    }
});

app.delete('/deletar-alvo/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM alvos WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: "Alvo e documentos removidos com sucesso" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Mantive as rotas auxiliares de documentos que estavam no seu código
app.get('/documento/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT arquivo_base64, mime_type, nome_arquivo FROM documentos_alvo WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Documento não encontrado" });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar documento" });
    }
});

app.delete('/deletar-documento/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM documentos_alvo WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: "Documento removido" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ SERVIDOR ATIVO NA PORTA ${PORT}`);
});