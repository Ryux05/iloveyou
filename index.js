const express = require("express");
const mongoose = require("mongoose");
const mkbas = require("./mkbas"); // Mengasumsikan mkbas adalah fungsi untuk menangani permintaan
const app = express();
const port = 8080;

// Ganti <username>, <password>, dan <cluster-address> dengan informasi yang sesuai
const mongoUrl = "mongodb+srv://myuko:loveyou@key.itkat.mongodb.net/key?retryWrites=true&w=majority"; 

// Koneksi ke MongoDB
mongoose.connect(mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.error("MongoDB connection error:", err));

// Definisikan model API Key menggunakan Mongoose
const apiKeySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    type: { type: String, enum: ['basic', 'pro'], required: true },
    requestCount: { type: Number, default: 0 }
});

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

// Atur trust proxy
app.set('trust proxy', true);

// Middleware untuk menghitung request
const requestCounts = {};

app.use((req, res, next) => {
    const apiKey = req.query.apikey;
    const keyType = apiKey && apiKey.startsWith("basic") ? "basic" : "pro";

    if (!apiKey) {
        return res.status(400).json("need parameter apikey");
    }

    if (!requestCounts[apiKey]) {
        requestCounts[apiKey] = { count: 0, lastRequest: Date.now() };
    }

    const currentTime = Date.now();
    const timeSinceLastRequest = currentTime - requestCounts[apiKey].lastRequest;

    // Reset count setiap 24 jam
    if (timeSinceLastRequest > 24 * 60 * 60 * 1000) {
        requestCounts[apiKey].count = 0;
    }

    if (keyType === "basic" && requestCounts[apiKey].count >= 5) {
        return res.status(429).json("Basic API key limit reached. Please try again after 24 hours.");
    }

    if (keyType === "pro" && requestCounts[apiKey].count >= 3000) {
        return res.status(429).json("PRO API key limit reached. Please try again after 24 hours.");
    }

    requestCounts[apiKey].count++;
    requestCounts[apiKey].lastRequest = currentTime;

    next();
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

    const data = await mkbas(url);
    apiKeyDoc.requestCount++;
    await apiKeyDoc.save();
    return res.status(200).json({ data, requests: apiKeyDoc.requestCount });
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
    const newApiKey = new ApiKey({ key: apiKey, type });
    await newApiKey.save();
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
