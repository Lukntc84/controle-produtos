const pool = require("../config/database");
const { enviarParaPlanilha } = require("../services/sheetsService");

function podeConferirFotos(req, res) {
    const usuario = req.session.usuario;

    if (!usuario) {
        res.redirect("/");
        return false;
    }

    if (usuario.tipo !== "admin" && usuario.tipo !== "fotografia") {
        res.status(403).send("Você não tem permissão para acessar a conferência de fotos.");
        return false;
    }

    return true;
}

exports.listarConferenciaFotos = async (req, res) => {
    if (!podeConferirFotos(req, res)) {
        return;
    }

    const busca = req.query.busca || "";
    const dataInicio = req.query.data_inicio || "";
    const dataFim = req.query.data_fim || "";
    const criadoPor = req.query.criado_por || "";

    let query = `
        SELECT 
            r.*,
            u.nome AS criado_por_nome
        FROM retiradas r
        LEFT JOIN usuarios u ON u.id = r.criado_por
        WHERE r.tipo_retirada = 'foto'
          AND r.status = 'Aguardando foto'
    `;

    const params = [];

    if (busca) {
        query += `
            AND (
                r.codigo_produto LIKE ?
                OR r.nome_produto LIKE ?
                OR r.cor LIKE ?
                OR r.tamanho LIKE ?
                OR r.numero_venda LIKE ?
                OR r.plataforma LIKE ?
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

    if (dataInicio) {
        query += " AND DATE(r.data_retirada) >= ?";
        params.push(dataInicio);
    }

    if (dataFim) {
        query += " AND DATE(r.data_retirada) <= ?";
        params.push(dataFim);
    }

    if (criadoPor) {
        query += " AND r.criado_por = ?";
        params.push(criadoPor);
    }

    query += " ORDER BY r.data_retirada ASC";

    try {
        const [retiradas] = await pool.execute(query, params);

        const [usuariosFotografia] = await pool.execute(
            `
            SELECT id, nome
            FROM usuarios
            WHERE ativo = 1
              AND tipo IN ('admin', 'fotografia', 'retirada')
            ORDER BY nome ASC
            `
        );

        const [[contador]] = await pool.execute(
            `
            SELECT COUNT(*) AS total
            FROM retiradas
            WHERE tipo_retirada = 'foto'
              AND status = 'Aguardando foto'
            `
        );

        return res.render("conferencia-fotos", {
            retiradas,
            usuariosFotografia,
            totalPendente: contador.total,
            filtroBusca: busca,
            filtroDataInicio: dataInicio,
            filtroDataFim: dataFim,
            filtroCriadoPor: criadoPor,
            erro: null,
            sucesso: null,
        });
    } catch (erro) {
        console.error("Erro ao carregar conferência de fotos:", erro);
        return res.send("Erro ao carregar conferência de fotos.");
    }
};

exports.confirmarSelecionadas = async (req, res) => {
    if (!podeConferirFotos(req, res)) {
        return;
    }

    const usuario = req.session.usuario;
    const selecionadasRaw = req.body.selecionadas || "";

    const ids = selecionadasRaw
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isInteger(id) && id > 0);

    if (ids.length === 0) {
        return res.redirect("/conferencia-fotos");
    }

    const placeholders = ids.map(() => "?").join(",");

    try {
        const [pendentes] = await pool.execute(
            `
            SELECT id
            FROM retiradas
            WHERE id IN (${placeholders})
              AND tipo_retirada = 'foto'
              AND status = 'Aguardando foto'
            `,
            ids
        );

        const idsValidos = pendentes.map((item) => item.id);

        if (idsValidos.length === 0) {
            return res.redirect("/conferencia-fotos");
        }

        const placeholdersValidos = idsValidos.map(() => "?").join(",");

        await pool.execute(
            `
            UPDATE retiradas
            SET 
                status = 'Foto tirada',
                confirmado_por = ?,
                atualizado_por = ?,
                data_confirmacao = NOW(),
                data_atualizacao = NOW()
            WHERE id IN (${placeholdersValidos})
              AND tipo_retirada = 'foto'
              AND status = 'Aguardando foto'
            `,
            [
                usuario.id,
                usuario.id,
                ...idsValidos,
            ]
        );

        const [retiradasAtualizadas] = await pool.execute(
            `
            SELECT *
            FROM retiradas
            WHERE id IN (${placeholdersValidos})
            `,
            idsValidos
        );

        for (const retirada of retiradasAtualizadas) {
            await enviarParaPlanilha({
                acao: "atualizar_status",
                id: retirada.id,
                tipo_retirada: retirada.tipo_retirada,
                status: retirada.status,
                atualizado_por: usuario.nome,
                data_atualizacao: retirada.data_atualizacao,
            });
        }

        return res.redirect("/conferencia-fotos?confirmadas=" + idsValidos.join(","));
    } catch (erro) {
        console.error("Erro ao confirmar fotos selecionadas:", erro);
        return res.send("Erro ao confirmar fotos selecionadas.");
    }
};

exports.marcarDesistenciaSelecionadas = async (req, res) => {
    if (!podeConferirFotos(req, res)) {
        return;
    }

    const usuario = req.session.usuario;
    const selecionadasRaw = req.body.selecionadas || "";

    const ids = selecionadasRaw
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isInteger(id) && id > 0);

    if (ids.length === 0) {
        return res.redirect("/conferencia-fotos");
    }

    const placeholders = ids.map(() => "?").join(",");

    try {
        await pool.execute(
            `
            UPDATE retiradas
            SET 
                status = 'Desistência',
                atualizado_por = ?,
                data_atualizacao = NOW()
            WHERE id IN (${placeholders})
              AND tipo_retirada = 'foto'
              AND status = 'Aguardando foto'
            `,
            [
                usuario.id,
                ...ids,
            ]
        );

        const [retiradasAtualizadas] = await pool.execute(
            `
            SELECT *
            FROM retiradas
            WHERE id IN (${placeholders})
            `,
            ids
        );

        for (const retirada of retiradasAtualizadas) {
            await enviarParaPlanilha({
                acao: "atualizar_status",
                id: retirada.id,
                tipo_retirada: retirada.tipo_retirada,
                status: retirada.status,
                atualizado_por: usuario.nome,
                data_atualizacao: retirada.data_atualizacao,
            });
        }

        return res.redirect("/conferencia-fotos?confirmadas=" + ids.join(","));
    } catch (erro) {
        console.error("Erro ao marcar desistência:", erro);
        return res.send("Erro ao marcar desistência.");
    }
};