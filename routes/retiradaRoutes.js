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

    if (
        usuario.tipo !== "admin" &&
        usuario.tipo !== "fotografia" &&
        usuario.tipo !== "retirada"
    ) {
        return res.status(403).send("Você não tem permissão para criar retirada.");
    }

    next();
}

router.get("/dashboard", exigeLogin, retiradaController.dashboard);

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
    retiradaController.confirmarFoto
);

router.post(
    "/retiradas/:id/status",
    exigeLogin,
    retiradaController.alterarStatus
);

module.exports = router;