const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");
const rateLimit = require("express-rate-limit");
const mkbas = require("./mkbas"); // Assuming mkbas is your function to handle requests
const app = express();
const port = 8080;

// Koneksi ke SQLite database
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.sqlite' // Nama file untuk menyimpan database
});

// Definisikan model API Key menggunakan Sequelize
const ApiKey = sequelize.define('ApiKey', {
    key: { type: DataTypes.STRING, allowNull: false, unique: true }, // Pastikan key unik
    type: { type: DataTypes.ENUM('basic', 'pro'), allowNull: false },
    requestCount: { type: DataTypes.INTEGER, defaultValue: 0 },
});

// Sinkronisasi model dengan database
sequelize.sync()
    .then(() => console.log("SQLite connected and synced"))
    .catch(err => console.error("SQLite connection error:", err));

// Rate limiters
const basicLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 5,
    message: "Basic API key limit reached. Try again later."
});

const proLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 5000,
    message: "Pro API key limit reached. Try again later."
});

// Routes
app.get("/", (req, res) => {
    res.json("invalid endpoints");
});

// Delta route
app.get("/delta", async (req, res) => {
    const url = req.query.url;
    const apiKey = req.query.apikey;

    if (!url) {
        return res.json("need parameter url");
    }

    if (!apiKey) {
        return res.json("need parameter apikey");
    }

    // Cari API key di SQLite
    const apiKeyDoc = await ApiKey.findOne({ where: { key: apiKey } });
    if (!apiKeyDoc) {
        return res.json("invalid API key");
    }

    if (apiKeyDoc.type === "basic") {
        return basicLimiter(req, res, async () => {
            const data = await mkbas(url);
            apiKeyDoc.requestCount++;
            await apiKeyDoc.save();
            res.json({ data, requests: apiKeyDoc.requestCount });
        });
    } else if (apiKeyDoc.type === "pro") {
        return proLimiter(req, res, async () => {
            const data = await mkbas(url);
            apiKeyDoc.requestCount++;
            await apiKeyDoc.save();
            res.json({ data, requests: apiKeyDoc.requestCount });
        });
    } else {
        return res.json("invalid API key");
    }
});

// Generate API key
app.get("/gen-key", async (req, res) => {
    const type = req.query.type;
    const randomNumber = Math.floor(Math.random() * 10000000);
    let apiKey;

    if (type === "basic") {
        apiKey = `basic_${randomNumber}`;
    } else if (type === "pro") {
        apiKey = `pro_${randomNumber}`;
    } else {
        return res.json("Invalid type. Use 'basic' or 'pro'.");
    }

    // Simpan API key baru di SQLite
    const newApiKey = await ApiKey.create({ key: apiKey, type });
    res.json({ apiKey: newApiKey.key });
});

// Remove API key
app.delete("/remove-key", async (req, res) => {
    const apiKey = req.query.apikey;

    if (!apiKey) {
        return res.json("need parameter apikey");
    }

    // Hapus API key dari SQLite
    const result = await ApiKey.destroy({ where: { key: apiKey } });
    if (result) {
        return res.json({ message: `API key ${apiKey} removed.` });
    } else {
        return res.json("invalid API key");
    }
});

// List all API keys by type
app.get("/list-keys", async (req, res) => {
    try {
        const basicKeys = await ApiKey.findAll({ where: { type: "basic" } });
        const proKeys = await ApiKey.findAll({ where: { type: "pro" } });

        res.json({
            basic: basicKeys,
            pro: proKeys
        });
    } catch (error) {
        console.error("Error retrieving API keys:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
