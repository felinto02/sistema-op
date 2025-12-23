const { Pool } = require('pg');

// O Render preenche a variável DATABASE_URL automaticamente se configurada no Environment
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Obrigatório para conexões seguras no Render
    }
});

// Teste de conexão imediato para ajudar nos logs
pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ ERRO AO CONECTAR NO BANCO DE DADOS:', err.stack);
    }
    console.log('🐘 BANCO DE DADOS CONECTADO COM SUCESSO');
    release();
});

module.exports = pool;