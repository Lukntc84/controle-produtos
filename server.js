const express = require("express");
const session = require("express-session");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const retiradaRoutes = require("./routes/retiradaRoutes");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
    session({
        secret: process.env.SESSION_SECRET || "segredo-temporario",
        resave: false,
        saveUninitialized: false,
    })
);

app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || null;
    next();
});

app.use("/", authRoutes);
app.use("/", retiradaRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});