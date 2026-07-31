const pool = require("./config/database");

async function testar() {
    try {
        const [resultado] = await pool.execute(
            "SELECT DATABASE() AS banco, NOW() AS agora"
        );

        console.log("Conectou no banco:");
        console.log(resultado[0]);
    } catch (erro) {
        console.error("Erro ao conectar:");
        console.error(erro.message);
    } finally {
        await pool.end();
    }
}

testar();