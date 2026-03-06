const { setDefaultResultOrder } = require('dns');
setDefaultResultOrder('ipv4first');

const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`,
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ ERRO AO CONECTAR NO BANCO DE DADOS:', err.message);
    }
    console.log('🐘 BANCO DE DADOS CONECTADO COM SUCESSO');
    release();
});

module.exports = pool;
