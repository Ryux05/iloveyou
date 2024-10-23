const express = require("express");
const { Sequelize, DataTypes } = require("sequelize");
const rateLimit = require("express-rate-limit");
const mkbas = require("./mkbas"); // Fungsi untuk menangani permintaan
const app = express();
const port = 8080;

// Koneksi ke SQLite database
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.DB_PATH || './data/database.sqlite' // Nama file untuk menyimpan database
});

// Definisikan model API Key menggunakan Sequelize
const ApiKey = sequelize.define('ApiKey', {
    key: { type: DataTypes.STRING, allowNull: false, unique: true },
    type: { type: DataTypes.ENUM('basic', 'pro'), allowNull: false },
    requestCount: { type: DataTypes.INTEGER, defaultValue: 0 },
});

// Sinkronisasi model dengan database
sequelize.sync({ alter: true })
    .then(() => console.log("SQLite connected and synced"))
    .catch(err => console.error("SQLite connection error:", err));

// Atur trust proxy
app.set('trust proxy', false); // Set true jika aplikasi di belakang proxy

// Rate limiters
const basicLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 5,
    message: "Basic API key limit reached. Please try again after 24 hours.",
    statusCode: 429
});

const proLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 3000,
    message: "PRO API key limit reached. Please try again after 24 hours.",
    statusCode: 429
});

// Routes
app.get("/", (req, res) => {
    res.json("invalid endpoints");
});

// Validasi URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Delta route
app.get("/delta", async (req, res) => {
    const url = req.query.url;
    const apiKey = req.query.apikey;

    if (!url || !isValidUrl(url)) {
        return res.status(400).json("Invalid URL provided");
    }

    if (!apiKey) {
        return res.status(400).json("Need parameter apikey");
    }

    try {
        const apiKeyDoc = await ApiKey.findOne({ where: { key: apiKey } });
        if (!apiKeyDoc) {
            return res.status(401).json("Invalid API key");
        }

        const limiter = apiKeyDoc.type === "basic" ? basicLimiter : proLimiter;

        return limiter(req, res, async () => {
            const data = await mkbas(url);
            apiKeyDoc.requestCount++;
            await apiKeyDoc.save();
            return res.status(200).json({ data, requests: apiKeyDoc.requestCount });
        });
    } catch (error) {
        console.error("Error processing request:", error);
        return res.status(500).json({ message: "Internal server error" });
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
        return res.status(400).json("Invalid type. Use 'basic' or 'pro'.");
    }

    try {
        const newApiKey = await ApiKey.create({ key: apiKey, type });
        return res.status(201).json({ apiKey: newApiKey.key });
    } catch (error) {
        console.error("Error generating API key:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// Remove API key
app.delete("/remove-key", async (req, res) => {
    const apiKey = req.query.apikey;

    if (!apiKey) {
        return res.status(400).json("Need parameter apikey");
    }

    try {
        const result = await ApiKey.destroy({ where: { key: apiKey } });
        if (result) {
            return res.status(200).json({ message: `API key ${apiKey} removed.` });
        } else {
            return res.status(404).json("Invalid API key");
        }
    } catch (error) {
        console.error("Error removing API key:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// List all API keys by type
app.get("/list-keys", async (req, res) => {
    try {
        const basicKeys = await ApiKey.findAll({ where: { type: "basic" } });
        const proKeys = await ApiKey.findAll({ where: { type: "pro" } });

        return res.status(200).json({
            basic: basicKeys,
            pro: proKeys
        });
    } catch (error) {
        console.error("Error retrieving API keys:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
