const path = require('path');
// Ajuste automático para encontrar o .env mesmo que você execute de dentro da pasta src
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();

// --- CONFIGURAÇÕES DE MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));

// --- VERIFICAÇÃO DE CONEXÃO COM O BANCO ---
// Isso aparecerá no terminal assim que você iniciar o servidor
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ ERRO AO CONECTAR NO BANCO DE DADOS:', err.message);
        console.log('Verifique se as credenciais no seu arquivo .env estão corretas.');
    } else {
        console.log('🐘 BANCO DE DADOS CONECTADO COM SUCESSO EM:', res.rows[0].now);
    }
});

// --- ROTA 1: CADASTRAR OU ATUALIZAR (HÍBRIDA) ---
app.post('/cadastrar-alvo', async (req, res) => {
    const client = await pool.connect();
    
    const { 
        modo, 
        idEdicao, 
        nome_arquivo_pdf,
        obs_tacticas,
        complemento,
        pdf_base64 
    } = req.body;

    try {
        await client.query('BEGIN');

        let alvoId = idEdicao;

        if (modo === 'edicao' && idEdicao) {
            // --- ATUALIZAÇÃO (UPDATE) ---
            await client.query(
                `UPDATE alvos SET 
                    nome=$1, cpf=$2, rg=$3, data_nascimento=$4, naturalidade=$5, 
                    uf_natural=$6, mae=$7, pai=$8 
                 WHERE id=$9`,
                [req.body.nome, req.body.cpf, req.body.rg, req.body.data_nascimento || null, req.body.naturalidade, req.body.uf_natural, req.body.mae, req.body.pai, idEdicao]
            );

            await client.query(
                `UPDATE alvo_enderecos SET 
                    rua=$1, numero=$2, bairro=$3, cidade=$4, uf_endereco=$5, link_mapa=$6, 
                    ponto_referencia=$7, observacoes_tacticas=$8 
                 WHERE alvo_id=$9`,
                [req.body.rua, req.body.numero, req.body.bairro, req.body.cidade, req.body.uf_endereco, req.body.link_mapa, complemento, obs_tacticas, idEdicao]
            );

            if (req.body.foto1 || req.body.foto2 || req.body.foto3) {
                await client.query(
                    `UPDATE alvo_fotos SET 
                        foto1=COALESCE($1, foto1), foto2=COALESCE($2, foto2), foto3=COALESCE($3, foto3) 
                     WHERE alvo_id=$4`,
                    [req.body.foto1, req.body.foto2, req.body.foto3, idEdicao]
                );
            }

            await client.query(
                `UPDATE alvo_inteligencia SET 
                    envolvimento_alvo=$1, detalhes_operacao=$2, 
                    mandado_pdf_base64=COALESCE($3, mandado_pdf_base64),
                    nome_arquivo_pdf=COALESCE($4, nome_arquivo_pdf)
                 WHERE alvo_id=$5`,
                [req.body.envolvimento_alvo, req.body.detalhes_operacao, pdf_base64, nome_arquivo_pdf, idEdicao]
            );

        } else {
            // --- NOVO CADASTRO (INSERT) ---
            const resAlvo = await client.query(
                `INSERT INTO alvos (nome, cpf, rg, data_nascimento, naturalidade, uf_natural, mae, pai) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                [req.body.nome, req.body.cpf, req.body.rg, req.body.data_nascimento || null, req.body.naturalidade, req.body.uf_natural, req.body.mae, req.body.pai]
            );
            alvoId = resAlvo.rows[0].id;

            await client.query(
                `INSERT INTO alvo_enderecos (alvo_id, rua, numero, bairro, cidade, uf_endereco, link_mapa, ponto_referencia, observacoes_tacticas) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [alvoId, req.body.rua, req.body.numero, req.body.bairro, req.body.cidade, req.body.uf_endereco, req.body.link_mapa, complemento, obs_tacticas]
            );

            await client.query(
                `INSERT INTO alvo_fotos (alvo_id, foto1, foto2, foto3) VALUES ($1, $2, $3, $4)`,
                [alvoId, req.body.foto1, req.body.foto2, req.body.foto3]
            );

            await client.query(
                `INSERT INTO alvo_inteligencia (alvo_id, envolvimento_alvo, detalhes_operacao, mandado_pdf_base64, nome_arquivo_pdf) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [alvoId, req.body.envolvimento_alvo, req.body.detalhes_operacao, pdf_base64, nome_arquivo_pdf || 'documento.pdf']
            );
        }

        await client.query('COMMIT');
        res.status(200).json({ success: true, id: alvoId, message: modo === 'edicao' ? "Atualizado" : "Cadastrado" });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("ERRO NA TRANSAÇÃO:", err.message);
        res.status(500).json({ success: false, message: "Erro interno no banco de dados." });
    } finally {
        client.release();
    }
});

// --- ROTA 2: BUSCAR LISTA ---
app.get('/buscar-alvos', async (req, res) => {
    const { nome } = req.query;
    try {
        const result = await pool.query(
            "SELECT id, nome, cpf FROM alvos WHERE nome ILIKE $1 ORDER BY nome LIMIT 10",
            [`%${nome}%`]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar alvos" });
    }
});

// --- ROTA 3: BUSCAR DETALHES ---
app.get('/buscar-detalhes/:id', async (req, res) => {
    try {
        const query = `
            SELECT a.*, e.rua, e.numero, e.bairro, e.cidade, e.uf_endereco, e.link_mapa, 
                   e.ponto_referencia as complemento, e.observacoes_tacticas as obs_tacticas,
                   i.envolvimento_alvo, i.detalhes_operacao, i.nome_arquivo_pdf,
                   f.foto1, f.foto2, f.foto3 -- ADICIONADO AS FOTOS AQUI
            FROM alvos a
            LEFT JOIN alvo_enderecos e ON a.id = e.alvo_id
            LEFT JOIN alvo_inteligencia i ON a.id = i.alvo_id
            LEFT JOIN alvo_fotos i ON a.id = f.alvo_id -- JOIN COM A TABELA DE FOTOS
            WHERE a.id = $1`;
        const result = await pool.query(query, [req.params.id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Erro ao buscar detalhes" });
    }
});

// --- ROTA 4: APAGAR ---
app.delete('/deletar-alvo/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM alvos WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: "Alvo removido" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ SERVIDOR ATIVO NA PORTA ${PORT}`);
});