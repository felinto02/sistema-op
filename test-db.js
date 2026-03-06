const { Client } = require("pg");

const client = new Client({
  host: "db.kuxaazxullhudxslwnyr.supabase.co",
  user: "postgres",
  password: "Ecg8On5aSWYg4Rlr",
  database: "postgres",
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    await client.connect();
    console.log("✅ Conectado ao banco Supabase!");

    const res = await client.query("SELECT NOW()");
    console.log("Hora do servidor:", res.rows[0]);

    await client.end();
  } catch (err) {
    console.error("❌ Erro ao conectar:", err);
  }
}

testConnection();
