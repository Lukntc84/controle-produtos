const pool = require("../config/database");
const { enviarParaPlanilha } = require("../services/sheetsService");

exports.dashboard = async (req, res) => {
    const periodo = req.query.periodo || "30dias";
    const dataInicio = req.query.data_inicio || "";
    const dataFim = req.query.data_fim || "";

    let filtroData = "";
    const params = [];

    if (periodo === "7dias") {
        filtroData = " AND data_retirada >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
    }

    if (periodo === "15dias") {
        filtroData = " AND data_retirada >= DATE_SUB(CURDATE(), INTERVAL 15 DAY)";
    }

    if (periodo === "30dias") {
        filtroData = " AND data_retirada >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
    }

    if (periodo === "personalizado") {
        if (dataInicio) {
            filtroData += " AND DATE(data_retirada) >= ?";
            params.push(dataInicio);
        }

        if (dataFim) {
            filtroData += " AND DATE(data_retirada) <= ?";
            params.push(dataFim);
        }
    }

    try {
        const [[totalRetiradas]] = await pool.execute(
            `SELECT COUNT(*) AS total FROM retiradas WHERE 1 = 1 ${filtroData}`,
            params
        );

        const [[totalVenda]] = await pool.execute(
            `SELECT COUNT(*) AS total FROM retiradas WHERE tipo_retirada = 'venda' ${filtroData}`,
            params
        );

        const [[totalFoto]] = await pool.execute(
            `SELECT COUNT(*) AS total FROM retiradas WHERE tipo_retirada = 'foto' ${filtroData}`,
            params
        );

        const [[aguardandoFoto]] = await pool.execute(
            `SELECT COUNT(*) AS total FROM retiradas WHERE status = 'Aguardando foto' ${filtroData}`,
            params
        );

        const [[fotoTirada]] = await pool.execute(
            `SELECT COUNT(*) AS total FROM retiradas WHERE status = 'Foto tirada' ${filtroData}`,
            params
        );

        const [[retiradoVenda]] = await pool.execute(
            `SELECT COUNT(*) AS total FROM retiradas WHERE status = 'Retirado para venda' ${filtroData}`,
            params
        );

        const [[desistencia]] = await pool.execute(
            `SELECT COUNT(*) AS total FROM retiradas WHERE status = 'Desistência' ${filtroData}`,
            params
        );

        const [[valorVenda]] = await pool.execute(
            `
            SELECT COALESCE(SUM(valor), 0) AS total
            FROM retiradas
            WHERE tipo_retirada = 'venda' ${filtroData}
            `,
            params
        );

        return res.render("dashboard", {
            totalRetiradas: totalRetiradas.total,
            totalVenda: totalVenda.total,
            totalFoto: totalFoto.total,
            aguardandoFoto: aguardandoFoto.total,
            fotoTirada: fotoTirada.total,
            retiradoVenda: retiradoVenda.total,
            desistencia: desistencia.total,
            valorVenda: valorVenda.total,
            filtroPeriodoDashboard: periodo,
            filtroDataInicioDashboard: dataInicio,
            filtroDataFimDashboard: dataFim,
        });
    } catch (erro) {
        console.error("Erro ao carregar dashboard:", erro);
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
        const [resultado] = await pool.execute(
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

        const [retiradas] = await pool.execute(
            "SELECT * FROM retiradas WHERE id = ? LIMIT 1",
            [resultado.insertId]
        );

        const retiradaCriada = retiradas[0];

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
        console.error("Erro ao salvar retirada:", erro);

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
        query += " AND r.tipo_retirada = ?";
        params.push(tipo);
    }

    if (status) {
        query += " AND r.status = ?";
        params.push(status);
    }

    if (busca) {
        query += `
            AND (
                r.codigo_produto LIKE ?
                OR r.nome_produto LIKE ?
                OR r.numero_venda LIKE ?
                OR r.plataforma LIKE ?
                OR r.cor LIKE ?
                OR r.tamanho LIKE ?
            )
        `;

        const termo = `%${busca}%`;

        params.push(
            termo,
            termo,
            termo,
            termo,
            termo,
            termo
        );
    }

    if (periodo === "hoje") {
        query += " AND DATE(r.data_retirada) = CURDATE()";
    }

    if (periodo === "7dias") {
        query += " AND r.data_retirada >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)";
    }

    if (periodo === "mes") {
        query += `
            AND YEAR(r.data_retirada) = YEAR(CURDATE())
            AND MONTH(r.data_retirada) = MONTH(CURDATE())
        `;
    }

    if (periodo === "personalizado" && dataInicio) {
        query += " AND DATE(r.data_retirada) >= ?";
        params.push(dataInicio);
    }

    if (periodo === "personalizado" && dataFim) {
        query += " AND DATE(r.data_retirada) <= ?";
        params.push(dataFim);
    }

    query += " ORDER BY r.data_retirada DESC";

    try {
        const [retiradas] = await pool.execute(query, params);

        return res.render("retiradas", {
            retiradas,
            filtroTipo: tipo,
            filtroStatus: status,
            filtroBusca: busca,
            filtroPeriodo: periodo,
            filtroDataInicio: dataInicio,
            filtroDataFim: dataFim,
        });
    } catch (erro) {
        console.error("Erro ao listar retiradas:", erro);
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
        await pool.execute(
            `
            UPDATE retiradas
            SET 
                status = 'Foto tirada',
                confirmado_por = ?,
                atualizado_por = ?,
                data_confirmacao = NOW(),
                data_atualizacao = NOW()
            WHERE id = ?
              AND tipo_retirada = 'foto'
            `,
            [usuario.id, usuario.id, id]
        );

        const [retiradas] = await pool.execute(
            "SELECT * FROM retiradas WHERE id = ? LIMIT 1",
            [id]
        );

        const retiradaAtualizada = retiradas[0];

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
        console.error("Erro ao confirmar foto:", erro);
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
        await pool.execute(
            `
            UPDATE retiradas
            SET 
                status = ?,
                atualizado_por = ?,
                data_atualizacao = NOW()
            WHERE id = ?
            `,
            [status, usuario.id, id]
        );

        const [retiradas] = await pool.execute(
            "SELECT * FROM retiradas WHERE id = ? LIMIT 1",
            [id]
        );

        const retiradaAtualizada = retiradas[0];

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
        console.error("Erro ao alterar status:", erro);
        return res.send("Erro ao alterar status.");
    }
};