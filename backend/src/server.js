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
// CRIAR TABELAS SE NÃO EXISTIREM
// ============================================
const criarTabelas = async () => {
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

        await pool.query(`
            CREATE TABLE IF NOT EXISTS alvo_fotos_local (
                id SERIAL PRIMARY KEY,
                alvo_id INTEGER REFERENCES alvos(id) ON DELETE CASCADE,
                foto1 TEXT,
                foto2 TEXT,
                CONSTRAINT alvo_fotos_local_alvo_id_unique UNIQUE (alvo_id)
            )
        `);
        console.log('✅ Tabela alvo_fotos_local verificada/criada');

    } catch (err) {
        console.error('❌ Erro ao criar tabelas:', err.message);
    }
};

// Inicialização
verificarConexaoDB();
criarTabelas();

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

const atualizarAlvo = async (client, dados, idEdicao) => {
    const { nome, cpf, rg, data_nascimento, naturalidade, uf_natural, mae, pai } = dados;

    // 1. Atualiza dados básicos do alvo (sem fotos - ficam em tabelas próprias)
    // Verifica antes se o CPF já pertence a outro alvo
    if (cpf) {
        const cpfExistente = await client.query(
            `SELECT id FROM alvos WHERE cpf = $1 AND id != $2`,
            [cpf, idEdicao]
        );
        if (cpfExistente.rows.length > 0) {
            throw new Error(`CPF ${cpf} já está cadastrado para outro registro (ID: ${cpfExistente.rows[0].id})`);
        }
    }

    await client.query(
        `UPDATE alvos SET 
            nome=$1, cpf=$2, rg=UPPER($3), data_nascimento=$4, naturalidade=$5, 
            uf_natural=$6, mae=$7, pai=$8
        WHERE id=$9`,
        [nome, cpf, rg, data_nascimento || null, naturalidade, uf_natural, mae, pai, idEdicao]
    );

    // 2. Atualiza Endereço (UPSERT)
    await client.query(
        `INSERT INTO alvo_enderecos 
            (alvo_id, rua, numero, bairro, cidade, uf_endereco, link_mapa, ponto_referencia, observacoes_tacticas)
         VALUES ($9, $1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (alvo_id) DO UPDATE SET
            rua=$1, numero=$2, bairro=$3, cidade=$4, uf_endereco=$5,
            link_mapa=$6, ponto_referencia=$7, observacoes_tacticas=$8`,
        [dados.rua, dados.numero, dados.bairro, dados.cidade, dados.uf_endereco,
         dados.link_mapa, dados.complemento, dados.obs_tacticas, idEdicao]
    );

    // 3. Atualiza Fotos do Alvo (UPSERT - preserva foto existente se nova não for enviada)
    await client.query(
        `INSERT INTO alvo_fotos (alvo_id, foto1, foto2, foto3)
         VALUES ($4, $1, $2, $3)
         ON CONFLICT (alvo_id) DO UPDATE SET
            foto1=COALESCE(EXCLUDED.foto1, alvo_fotos.foto1),
            foto2=COALESCE(EXCLUDED.foto2, alvo_fotos.foto2),
            foto3=COALESCE(EXCLUDED.foto3, alvo_fotos.foto3)`,
        [dados.foto1, dados.foto2, dados.foto3, idEdicao]
    );

    // 4. Atualiza Fotos do Local (UPSERT - preserva foto existente se nova não for enviada)
    await client.query(
        `INSERT INTO alvo_fotos_local (alvo_id, foto1, foto2)
         VALUES ($3, $1, $2)
         ON CONFLICT (alvo_id) DO UPDATE SET
            foto1=COALESCE(EXCLUDED.foto1, alvo_fotos_local.foto1),
            foto2=COALESCE(EXCLUDED.foto2, alvo_fotos_local.foto2)`,
        [dados.foto_local1, dados.foto_local2, idEdicao]
    );

    // 5. Atualiza Inteligência (UPSERT)
    await client.query(
        `INSERT INTO alvo_inteligencia (alvo_id, envolvimento_alvo, detalhes_operacao)
         VALUES ($3, $1, $2)
         ON CONFLICT (alvo_id) DO UPDATE SET
            envolvimento_alvo=$1, detalhes_operacao=$2`,
        [dados.envolvimento_alvo, dados.detalhes_operacao, idEdicao]
    );

    // 6. Remove documentos antigos para evitar duplicatas ao reeditar
    if (dados.documentos && dados.documentos.length > 0) {
        await client.query('DELETE FROM documentos_alvo WHERE alvo_id = $1', [idEdicao]);
    }

    return idEdicao;
};

const criarNovoAlvo = async (client, dados) => {
    const { nome, cpf, rg, data_nascimento, naturalidade, uf_natural, mae, pai } = dados;

    // 1. Insere dados básicos do alvo (sem fotos)
    const resAlvo = await client.query(
        `INSERT INTO alvos (nome, cpf, rg, data_nascimento, naturalidade, uf_natural, mae, pai) 
         VALUES ($1, $2, UPPER($3), $4, $5, $6, $7, $8) RETURNING id`,
        [nome, cpf, rg, data_nascimento || null, naturalidade, uf_natural, mae, pai]
    );

    const alvoId = resAlvo.rows[0].id;

    // 2. Endereço
    await client.query(
        `INSERT INTO alvo_enderecos 
            (alvo_id, rua, numero, bairro, cidade, uf_endereco, link_mapa, ponto_referencia, observacoes_tacticas) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [alvoId, dados.rua, dados.numero, dados.bairro, dados.cidade, dados.uf_endereco,
         dados.link_mapa, dados.complemento, dados.obs_tacticas]
    );

    // 3. Fotos do Alvo
    await client.query(
        `INSERT INTO alvo_fotos (alvo_id, foto1, foto2, foto3) VALUES ($1, $2, $3, $4)`,
        [alvoId, dados.foto1 || null, dados.foto2 || null, dados.foto3 || null]
    );

    // 4. Fotos do Local
    await client.query(
        `INSERT INTO alvo_fotos_local (alvo_id, foto1, foto2) VALUES ($1, $2, $3)`,
        [alvoId, dados.foto_local1 || null, dados.foto_local2 || null]
    );

    // 5. Inteligência
    await client.query(
        `INSERT INTO alvo_inteligencia (alvo_id, envolvimento_alvo, detalhes_operacao) 
         VALUES ($1, $2, $3)`,
        [alvoId, dados.envolvimento_alvo, dados.detalhes_operacao]
    );

    return alvoId;
};

const salvarDocumentos = async (client, alvoId, documentos) => {
    if (!documentos || !Array.isArray(documentos) || documentos.length === 0) return 0;

    for (const doc of documentos) {
        await client.query(
            `INSERT INTO documentos_alvo 
                (alvo_id, tipo_documento, nome_arquivo, descricao, arquivo_base64, mime_type) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                alvoId,
                doc.tipo || 'Documento',
                doc.nome_arquivo || doc.nome,
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
    res.sendFile(path.join(__dirname, '../../frontend/home.html'));
});

// Busca de alvos
app.get('/buscar-alvos', async (req, res) => {
    try {
        const { termo } = req.query;
        if (!termo) return res.json([]);

        const result = await pool.query(
            `SELECT id, nome, cpf FROM alvos WHERE nome ILIKE $1 LIMIT 10`,
            [`%${termo}%`]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Erro na busca:', err.message);
        res.status(500).json({ error: "Erro ao buscar dados" });
    }
});

// Cadastrar ou editar alvo
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

        if (documentos && documentos.length > 0) {
            await salvarDocumentos(client, alvoId, documentos);
        }

        await client.query('COMMIT');

        res.status(200).json({
            success: true,
            id: alvoId,
            message: modo === 'edicao' ? "Registro atualizado com sucesso" : "Cadastro realizado com sucesso"
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERRO NA TRANSAÇÃO:", err.message);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        client.release();
    }
});

// Buscar detalhes completos de um alvo
app.get('/buscar-detalhes/:id', async (req, res) => {
    try {
        const queryPrincipal = `
            SELECT 
                a.id, a.nome, a.cpf, a.rg, a.data_nascimento,
                a.naturalidade, a.uf_natural, a.mae, a.pai, a.criado_em,
                e.rua, e.numero, e.bairro, e.cidade, e.uf_endereco, e.link_mapa,
                e.ponto_referencia AS complemento,
                e.observacoes_tacticas AS obs_tacticas,
                i.envolvimento_alvo, i.detalhes_operacao,
                f.foto1, f.foto2, f.foto3,
                fl.foto1 AS foto_local1, fl.foto2 AS foto_local2
            FROM alvos a
            LEFT JOIN alvo_enderecos e     ON a.id = e.alvo_id
            LEFT JOIN alvo_inteligencia i  ON a.id = i.alvo_id
            LEFT JOIN alvo_fotos f         ON a.id = f.alvo_id
            LEFT JOIN alvo_fotos_local fl  ON a.id = fl.alvo_id
            WHERE a.id = $1`;

        const resultPrincipal = await pool.query(queryPrincipal, [req.params.id]);
        if (resultPrincipal.rows.length === 0)
            return res.status(404).json({ error: "Não encontrado" });

        const alvo = resultPrincipal.rows[0];

        const resultDocs = await pool.query(
            `SELECT id, tipo_documento, nome_arquivo, descricao, arquivo_base64, mime_type, data_upload 
             FROM documentos_alvo WHERE alvo_id = $1`,
            [req.params.id]
        );
        alvo.documentos = resultDocs.rows;

        res.json(alvo);
    } catch (err) {
        console.error('❌ Erro ao buscar detalhes:', err.message);
        res.status(500).json({ error: "Erro interno ao buscar detalhes" });
    }
});

// Deletar alvo
app.delete('/deletar-alvo/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM alvos WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: "Alvo removido com sucesso" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Buscar documento individual
app.get('/documento/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT arquivo_base64, mime_type, nome_arquivo FROM documentos_alvo WHERE id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0)
            return res.status(404).json({ error: "Documento não encontrado" });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar documento" });
    }
});

// Deletar documento
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