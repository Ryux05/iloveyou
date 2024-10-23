const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const mkbas = require("./mkbas"); // Mengasumsikan mkbas adalah fungsi Anda untuk menangani permintaan
const app = express();
const port = 8080;

// Koneksi ke MongoDB
const mongoURI = process.env.MONGO_URI || 'mongodb+srv://myuko:loveyou@key.itkat.mongodb.net/key?retryWrites=true&w=majority';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection error:", err));

// Definisikan model API Key menggunakan Mongoose
const apiKeySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    type: { type: String, enum: ['basic', 'pro'], required: true },
    requestCount: { type: Number, default: 0 },
}, { timestamps: true });

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

// Atur trust proxy
app.set('trust proxy', false);

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
    const apiKeyDoc = await ApiKey.findOne({ key: apiKey });
    if (!apiKeyDoc) {
        return res.status(401).json("invalid API key");
    }

    if (apiKeyDoc.type === "basic") {
        return basicLimiter(req, res, async () => {
            const data = await mkbas(url);
            apiKeyDoc.requestCount++;
            await apiKeyDoc.save();
            return res.status(200).json({ data, requests: apiKeyDoc.requestCount });
        });
    } else if (apiKeyDoc.type === "pro") {
        return proLimiter(req, res, async () => {
            const data = await mkbas(url);
            apiKeyDoc.requestCount++;
            await apiKeyDoc.save();
            return res.status(200).json({ data, requests: apiKeyDoc.requestCount });
        });
    } else {
        return res.status(401).json("invalid API key");
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

    // Simpan API key baru di MongoDB
    const newApiKey = await ApiKey.create({ key: apiKey, type });
    return res.status(201).json({ apiKey: newApiKey.key });
});

// Remove API key
app.delete("/remove-key", async (req, res) => {
    const apiKey = req.query.apikey;

    if (!apiKey) {
        return res.status(400).json("need parameter apikey");
    }

    // Hapus API key dari MongoDB
    const result = await ApiKey.deleteOne({ key: apiKey });
    if (result.deletedCount > 0) {
        return res.status(200).json({ message: `API key ${apiKey} removed.` });
    } else {
        return res.status(404).json("invalid API key");
    }
});

// List all API keys by type
app.get("/list-keys", async (req, res) => {
    try {
        const basicKeys = await ApiKey.find({ type: "basic" });
        const proKeys = await ApiKey.find({ type: "pro" });

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
