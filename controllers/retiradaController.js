const pool = require("../config/database");
const { enviarParaPlanilha } = require("../services/sheetsService");


exports.dashboard = async (req, res) => {
    const periodo = req.query.periodo || "30dias";
    const dataInicio = req.query.data_inicio || "";
    const dataFim = req.query.data_fim || "";

    let filtroData = "";
    const params = [];

    if (periodo === "7dias") {
        filtroData = " AND data_retirada >= CURRENT_DATE - INTERVAL '7 days'";
    }

    if (periodo === "15dias") {
        filtroData = " AND data_retirada >= CURRENT_DATE - INTERVAL '15 days'";
    }

    if (periodo === "30dias") {
        filtroData = " AND data_retirada >= CURRENT_DATE - INTERVAL '30 days'";
    }

    if (periodo === "personalizado") {
        if (dataInicio) {
            params.push(dataInicio);
            filtroData += ` AND data_retirada::date >= $${params.length}`;
        }

        if (dataFim) {
            params.push(dataFim);
            filtroData += ` AND data_retirada::date <= $${params.length}`;
        }
    }

    try {
        const totalRetiradas = await pool.query(
            `SELECT COUNT(*)::int AS total FROM retiradas WHERE 1 = 1 ${filtroData}`,
            params
        );

        const totalVenda = await pool.query(
            `SELECT COUNT(*)::int AS total FROM retiradas WHERE tipo_retirada = 'venda' ${filtroData}`,
            params
        );

        const totalFoto = await pool.query(
            `SELECT COUNT(*)::int AS total FROM retiradas WHERE tipo_retirada = 'foto' ${filtroData}`,
            params
        );

        const aguardandoFoto = await pool.query(
            `SELECT COUNT(*)::int AS total FROM retiradas WHERE status = 'Aguardando foto' ${filtroData}`,
            params
        );

        const fotoTirada = await pool.query(
            `SELECT COUNT(*)::int AS total FROM retiradas WHERE status = 'Foto tirada' ${filtroData}`,
            params
        );

        const retiradoVenda = await pool.query(
            `SELECT COUNT(*)::int AS total FROM retiradas WHERE status = 'Retirado para venda' ${filtroData}`,
            params
        );

        const desistencia = await pool.query(
            `SELECT COUNT(*)::int AS total FROM retiradas WHERE status = 'Desistência' ${filtroData}`,
            params
        );

        const valorVenda = await pool.query(
            `SELECT COALESCE(SUM(valor), 0)::numeric AS total 
             FROM retiradas 
             WHERE tipo_retirada = 'venda' ${filtroData}`,
            params
        );

        return res.render("dashboard", {
            totalRetiradas: totalRetiradas.rows[0].total,
            totalVenda: totalVenda.rows[0].total,
            totalFoto: totalFoto.rows[0].total,
            aguardandoFoto: aguardandoFoto.rows[0].total,
            fotoTirada: fotoTirada.rows[0].total,
            retiradoVenda: retiradoVenda.rows[0].total,
            desistencia: desistencia.rows[0].total,
            valorVenda: valorVenda.rows[0].total,
            filtroPeriodoDashboard: periodo,
            filtroDataInicioDashboard: dataInicio,
            filtroDataFimDashboard: dataFim,
        });
    } catch (erro) {
        console.error(erro);
        return res.send("Erro ao carregar dashboard.");
    }
};

exports.telaNovaRetirada = (req, res) => {
    return res.render("nova-retirada", {
        erro: null,
    });
};

exports.salvarRetirada = async (req, res) => {
    const {
        codigo_produto,
        nome_produto,
        numero_venda,
        plataforma,
        valor,
        tamanho,
        cor,
        tipo_retirada,
    } = req.body;

    let status = "";

    if (tipo_retirada === "venda") {
        status = "Retirado para venda";
    } else if (tipo_retirada === "foto") {
        status = "Aguardando foto";
    } else {
        return res.render("nova-retirada", {
            erro: "Tipo de retirada inválido.",
        });
    }

    try {
        const resultado = await pool.query(
            `
            INSERT INTO retiradas (
                codigo_produto,
                nome_produto,
                numero_venda,
                plataforma,
                valor,
                tamanho,
                cor,
                quantidade,
                loja_origem,
                tipo_retirada,
                responsavel_retirada,
                status,
                observacao,
                criado_por
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13, $14
            )
            RETURNING *
            `,
            [
                codigo_produto,
                nome_produto,
                numero_venda || null,
                plataforma || null,
                valor || 0,
                tamanho || null,
                cor || null,
                1,
                "-",
                tipo_retirada,
                req.session.usuario.nome,
                status,
                null,
                req.session.usuario.id,
            ]
        );

        const retiradaCriada = resultado.rows[0];

        await enviarParaPlanilha({
            acao: "criar_retirada",
            id: retiradaCriada.id,
            codigo_produto: retiradaCriada.codigo_produto,
            nome_produto: retiradaCriada.nome_produto,
            numero_venda: retiradaCriada.numero_venda,
            plataforma: retiradaCriada.plataforma,
            data_retirada: retiradaCriada.data_retirada,
            valor: retiradaCriada.valor,
            tamanho: retiradaCriada.tamanho,
            cor: retiradaCriada.cor,
            tipo_retirada: retiradaCriada.tipo_retirada,
            status: retiradaCriada.status,
            criado_por: req.session.usuario.nome,
            confirmado_por: "",
            data_confirmacao: "",
            atualizado_por: "",
            data_atualizacao: "",
        });

        return res.redirect("/retiradas");
    } catch (erro) {
        console.error(erro);

        return res.render("nova-retirada", {
            erro: "Erro ao salvar retirada.",
        });
    }
};

exports.listarRetiradas = async (req, res) => {
    const tipo = req.query.tipo || "";
    const status = req.query.status || "";
    const busca = req.query.busca || "";
    const periodo = req.query.periodo || "";
    const dataInicio = req.query.data_inicio || "";
    const dataFim = req.query.data_fim || "";

    let query = `
        SELECT 
            r.*,
            u.nome AS criado_por_nome,
            c.nome AS confirmado_por_nome,
            a.nome AS atualizado_por_nome
        FROM retiradas r
        LEFT JOIN usuarios u ON u.id = r.criado_por
        LEFT JOIN usuarios c ON c.id = r.confirmado_por
        LEFT JOIN usuarios a ON a.id = r.atualizado_por
        WHERE 1 = 1
    `;

    const params = [];

    if (tipo) {
        params.push(tipo);
        query += ` AND r.tipo_retirada = $${params.length}`;
    }

    if (status) {
        params.push(status);
        query += ` AND r.status = $${params.length}`;
    }

    if (busca) {
        params.push(`%${busca}%`);

        query += `
            AND (
                r.codigo_produto ILIKE $${params.length}
                OR r.nome_produto ILIKE $${params.length}
                OR r.numero_venda ILIKE $${params.length}
                OR r.plataforma ILIKE $${params.length}
                OR r.cor ILIKE $${params.length}
                OR r.tamanho ILIKE $${params.length}
            )
        `;
    }

    if (periodo === "hoje") {
        query += `
            AND r.data_retirada::date = CURRENT_DATE
        `;
    }

    if (periodo === "7dias") {
        query += `
            AND r.data_retirada >= CURRENT_DATE - INTERVAL '7 days'
        `;
    }

    if (periodo === "mes") {
        query += `
            AND date_trunc('month', r.data_retirada) = date_trunc('month', CURRENT_DATE)
        `;
    }

    if (periodo === "personalizado" && dataInicio) {
        params.push(dataInicio);
        query += ` AND r.data_retirada::date >= $${params.length}`;
    }

    if (periodo === "personalizado" && dataFim) {
        params.push(dataFim);
        query += ` AND r.data_retirada::date <= $${params.length}`;
    }

    query += " ORDER BY r.data_retirada DESC";

    try {
        const resultado = await pool.query(query, params);

        return res.render("retiradas", {
            retiradas: resultado.rows,
            filtroTipo: tipo,
            filtroStatus: status,
            filtroBusca: busca,
            filtroPeriodo: periodo,
            filtroDataInicio: dataInicio,
            filtroDataFim: dataFim,
        });
    } catch (erro) {
        console.error(erro);
        return res.send("Erro ao listar retiradas.");
    }
};

exports.confirmarFoto = async (req, res) => {
    const usuario = req.session.usuario;

    if (usuario.tipo !== "fotografia" && usuario.tipo !== "admin") {
        return res.status(403).send("Você não tem permissão para confirmar foto.");
    }

    const id = req.params.id;

    try {
        const resultado = await pool.query(
            `
            UPDATE retiradas
            SET 
                status = 'Foto tirada',
                confirmado_por = $1,
                atualizado_por = $1,
                data_confirmacao = CURRENT_TIMESTAMP,
                data_atualizacao = CURRENT_TIMESTAMP
            WHERE id = $2
              AND tipo_retirada = 'foto'
            RETURNING *
            `,
            [usuario.id, id]
        );

        const retiradaAtualizada = resultado.rows[0];

        if (retiradaAtualizada) {
            await enviarParaPlanilha({
                acao: "atualizar_status",
                id: retiradaAtualizada.id,
                tipo_retirada: retiradaAtualizada.tipo_retirada,
                status: retiradaAtualizada.status,
                atualizado_por: usuario.nome,
                data_atualizacao: retiradaAtualizada.data_atualizacao,
            });
        }

        return res.redirect("/retiradas?tipo=foto");
    } catch (erro) {
        console.error(erro);
        return res.send("Erro ao confirmar foto.");
    }
};

exports.alterarStatus = async (req, res) => {
    const usuario = req.session.usuario;

    if (usuario.tipo !== "fotografia" && usuario.tipo !== "admin") {
        return res.status(403).send("Você não tem permissão para alterar status.");
    }

    const { status } = req.body;
    const id = req.params.id;

    const statusPermitidos = [
        "Desistência",
        "Aguardando foto",
        "Foto tirada",
        "Retirado para venda",
    ];

    if (!statusPermitidos.includes(status)) {
        return res.status(400).send("Status inválido.");
    }

    try {
        const resultado = await pool.query(
            `
            UPDATE retiradas
            SET 
                status = $1,
                atualizado_por = $2,
                data_atualizacao = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
            `,
            [status, usuario.id, id]
        );

        const retiradaAtualizada = resultado.rows[0];

        if (retiradaAtualizada) {
            await enviarParaPlanilha({
                acao: "atualizar_status",
                id: retiradaAtualizada.id,
                tipo_retirada: retiradaAtualizada.tipo_retirada,
                status: retiradaAtualizada.status,
                atualizado_por: usuario.nome,
                data_atualizacao: retiradaAtualizada.data_atualizacao,
            });
        }

        return res.redirect("/retiradas");
    } catch (erro) {
        console.error(erro);
        return res.send("Erro ao alterar status.");
    }
};