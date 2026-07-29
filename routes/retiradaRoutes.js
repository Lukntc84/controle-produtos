const express = require("express");
const router = express.Router();

const retiradaController = require("../controllers/retiradaController");

function exigeLogin(req, res, next) {
    if (!req.session.usuario) {
        return res.redirect("/");
    }

    next();
}

router.get("/dashboard", exigeLogin, retiradaController.dashboard);

router.get(
    "/nova-retirada",
    exigeLogin,
    retiradaController.telaNovaRetirada
);

router.post(
    "/nova-retirada",
    exigeLogin,
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