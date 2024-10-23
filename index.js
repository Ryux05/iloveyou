const express = require("express");
const mkbas = require("./mkbas"); // Mengasumsikan mkbas adalah fungsi Anda untuk menangani permintaan
const app = express();
const port = 8080;

// Koneksi ke MongoDB
const { MongoClient } = require("mongodb");
const mongoUrl = "mongodb+srv://myuko:<db_password>@key.itkat.mongodb.net/key";
const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
let db;

client.connect()
    .then(() => {
        console.log("MongoDB connected");
        db = client.db("key");
    })
    .catch(err => console.error("MongoDB connection error:", err));

// Definisikan objek untuk menyimpan jumlah permintaan
const rateLimits = {
    basic: {},
    pro: {}
};

// Fungsi untuk memeriksa dan memperbarui jumlah permintaan
const checkRateLimit = (key, type) => {
    const currentTime = Date.now();
    const timeWindow = 24 * 60 * 60 * 1000; // 24 jam
    const limit = type === "basic" ? 5 : 3000;

    if (!rateLimits[type][key]) {
        rateLimits[type][key] = { count: 1, timestamp: currentTime };
    } else {
        if (currentTime - rateLimits[type][key].timestamp < timeWindow) {
            if (rateLimits[type][key].count >= limit) {
                return false; // Limit tercapai
            }
            rateLimits[type][key].count++;
        } else {
            // Reset count jika sudah melewati time window
            rateLimits[type][key] = { count: 1, timestamp: currentTime };
        }
    }
    return true; // Masih dalam batas
};

// Routes
app.get("/", (req, res) => {
    res.json("invalid endpoints");
});

// Delta route
app.get("/delta", async (req, res) => {
    const url = req.query.url;
    const apiKey = req.query.apikey;

    if (!url) {
        return res.status(400).json("need parameter url");
    }

    if (!apiKey) {
        return res.status(400).json("need parameter apikey");
    }

    // Cari API key di MongoDB
    const apiKeyDoc = await db.collection("ApiKeys").findOne({ key: apiKey });
    if (!apiKeyDoc) {
        return res.status(401).json("invalid API key");
    }

    const isAllowed = checkRateLimit(apiKey, apiKeyDoc.type);
    if (!isAllowed) {
        return res.status(429).json(`${apiKeyDoc.type.toUpperCase()} API key limit reached. Please try again after 24 hours.`);
    }

    const data = await mkbas(url);
    return res.status(200).json({ data, requests: rateLimits[apiKeyDoc.type][apiKey].count });
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

    // Simpan API key baru di MongoDB
    await db.collection("ApiKeys").insertOne({ key: apiKey, type });
    return res.status(201).json({ apiKey });
});

// Remove API key
app.delete("/remove-key", async (req, res) => {
    const apiKey = req.query.apikey;

    if (!apiKey) {
        return res.status(400).json("need parameter apikey");
    }

    // Hapus API key dari MongoDB
    const result = await db.collection("ApiKeys").deleteOne({ key: apiKey });
    if (result.deletedCount > 0) {
        return res.status(200).json({ message: `API key ${apiKey} removed.` });
    } else {
        return res.status(404).json("invalid API key");
    }
});

// List all API keys by type
app.get("/list-keys", async (req, res) => {
    try {
        const basicKeys = await db.collection("ApiKeys").find({ type: "basic" }).toArray();
        const proKeys = await db.collection("ApiKeys").find({ type: "pro" }).toArray();

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
