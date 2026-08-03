const express = require("express");
const router = express.Router();

const conferenciaController = require("../controllers/conferenciaController");

function exigeLogin(req, res, next) {
    if (!req.session.usuario) {
        return res.redirect("/");
    }

    next();
}

router.get(
    "/conferencia-fotos",
    exigeLogin,
    conferenciaController.listarConferenciaFotos
);

router.post(
    "/conferencia-fotos/confirmar",
    exigeLogin,
    conferenciaController.confirmarSelecionadas
);

router.post(
    "/conferencia-fotos/desistencia",
    exigeLogin,
    conferenciaController.marcarDesistenciaSelecionadas
);

module.exports = router;