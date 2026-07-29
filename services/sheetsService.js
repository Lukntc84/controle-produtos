const axios = require("axios");
require("dotenv").config();

async function enviarParaPlanilha(payload) {
    if (!process.env.SHEETS_WEBAPP_URL || !process.env.SHEETS_TOKEN) {
        console.warn("Integração com Google Sheets não configurada.");
        return null;
    }

    try {
        const resposta = await axios.post(
            process.env.SHEETS_WEBAPP_URL,
            {
                ...payload,
                token: process.env.SHEETS_TOKEN,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
                timeout: 15000,
            }
        );

        console.log("Resposta Google Sheets:", resposta.data);

        return resposta.data;
    } catch (erro) {
        console.error("Erro ao enviar para Google Sheets:");
        console.error(erro.message);

        return null;
    }
}

module.exports = {
    enviarParaPlanilha,
};