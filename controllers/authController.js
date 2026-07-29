const bcrypt = require("bcryptjs");
const pool = require("../config/database");

exports.telaLogin = (req, res) => {
    if (req.session.usuario) {
        return res.redirect("/dashboard");
    }

    return res.render("login", {
        erro: null,
    });
};

exports.login = async (req, res) => {
    const { email, senha } = req.body;

    try {
        const [usuarios] = await pool.execute(
            "SELECT * FROM usuarios WHERE email = ? AND ativo = 1 LIMIT 1",
            [email]
        );

        if (usuarios.length === 0) {
            return res.render("login", {
                erro: "E-mail ou senha inválidos.",
            });
        }

        const usuario = usuarios[0];

        const senhaConfere = await bcrypt.compare(senha, usuario.senha);

        if (!senhaConfere) {
            return res.render("login", {
                erro: "E-mail ou senha inválidos.",
            });
        }

        req.session.usuario = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            tipo: usuario.tipo,
        };

        return res.redirect("/dashboard");
    } catch (erro) {
        console.error("Erro no login:", erro);

        return res.render("login", {
            erro: "Erro ao tentar fazer login.",
        });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
};