const express = require("express");
const router = express.Router();

const retiradaController = require("../controllers/retiradaController");

function exigeLogin(req, res, next) {
    if (!req.session.usuario) {
        return res.redirect("/");
    }

    next();
}

function podeCriarRetirada(req, res, next) {
    const usuario = req.session.usuario;

    if (!usuario) {
        return res.redirect("/");
    }

    if (
        usuario.tipo !== "admin" &&
        usuario.tipo !== "fotografia" &&
        usuario.tipo !== "retirada"
    ) {
        return res.status(403).send("Você não tem permissão para criar retirada.");
    }

    next();
}

function podeAlterarStatus(req, res, next) {
    const usuario = req.session.usuario;

    if (!usuario) {
        return res.redirect("/");
    }

    if (
        usuario.tipo !== "admin" &&
        usuario.tipo !== "fotografia"
    ) {
        return res.status(403).send("Você não tem permissão para alterar status.");
    }

    next();
}

router.get(
    "/dashboard",
    exigeLogin,
    retiradaController.dashboard
);

router.get(
    "/nova-retirada",
    exigeLogin,
    podeCriarRetirada,
    retiradaController.telaNovaRetirada
);

router.post(
    "/nova-retirada",
    exigeLogin,
    podeCriarRetirada,
    retiradaController.salvarRetirada
);

router.get(
    "/retiradas",
    exigeLogin,
    retiradaController.listarRetiradas
);

router.post(
    "/retiradas/:id/confirmar-foto",
    exigeLogin,
    podeAlterarStatus,
    retiradaController.confirmarFoto
);

router.post(
    "/retiradas/:id/status",
    exigeLogin,
    podeAlterarStatus,
    retiradaController.alterarStatus
);

module.exports = router;