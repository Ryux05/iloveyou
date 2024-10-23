const express = require("express");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const mkbas = require("./mkbas"); // Assuming mkbas is defined in another file
const app = express();
const port = 8080;

// MongoDB connection string
const mongoDB = "mongodb+srv://myuko:loveyou@key.itkat.mongodb.net/?retryWrites=true&w=majority&appName=key";
mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection error:", err));

// Define Mongoose schema and model
const apiKeySchema = new mongoose.Schema({
    key: { type: String, required: true },
    type: { type: String, enum: ['basic', 'pro'], required: true },
    ownerId: { type: String, required: true },
    requestCount: { type: Number, default: 0 },
});

const ApiKey = mongoose.model("ApiKey", apiKeySchema);

// Rate limiters
const basicLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 5, // Limit basic users to 5 requests per day
    message: "Basic API key limit reached. Try again later."
});

const proLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 5000, // Limit pro users to 5000 requests per day
    message: "Pro API key limit reached. Try again later."
});

app.get("/", (req, res) => {
    res.json("invalid endpoints");
});

app.get("/delta", async (req, res) => {
    const url = req.query.url;
    const apiKey = req.query.apikey; // Get API key from query parameter

    if (!url) {
        return res.json("need parameter url");
    }

    if (!apiKey) {
        return res.json("need parameter apikey");
    }

    // Find API key in the database
    const apiKeyDoc = await ApiKey.findOne({ key: apiKey });
    if (!apiKeyDoc) {
        return res.json("invalid API key");
    }

    // Initialize request count for the API key if it doesn't exist
    if (apiKeyDoc.requestCount === undefined) {
        apiKeyDoc.requestCount = 0; // Initialize the count for new API keys
    }

    // Check the type of API key
    if (apiKeyDoc.type === "basic") {
        return basicLimiter(req, res, async () => {
            const data = await mkbas(url);
            apiKeyDoc.requestCount++; // Increment request count
            await apiKeyDoc.save(); // Save updated request count
            res.json({ data, requests: apiKeyDoc.requestCount }); // Return data with request count
        });
    } else if (apiKeyDoc.type === "pro") {
        return proLimiter(req, res, async () => {
            const data = await mkbas(url);
            apiKeyDoc.requestCount++; // Increment request count
            await apiKeyDoc.save(); // Save updated request count
            res.json({ data, requests: apiKeyDoc.requestCount }); // Return data with request count
        });
    } else {
        return res.json("invalid API key");
    }
});

// Generate a random basic or pro API key
app.get("/generate-key", async (req, res) => {
    const type = req.query.type; // 'basic' or 'pro'
    const randomNumber = Math.floor(Math.random() * 10000000); // Generates a random number
    let apiKey;

    if (type === "basic") {
        apiKey = `basic_${randomNumber}`;
    } else if (type === "pro") {
        apiKey = `pro_${randomNumber}`;
    } else {
        return res.json("Invalid type. Use 'basic' or 'pro'.");
    }

    // Create a new API key document in MongoDB
    const newApiKey = new ApiKey({ key: apiKey, type: type, ownerId: req.query.ownerId });
    await newApiKey.save(); // Save the new API key to the database

    res.json({ apiKey });
});

// Remove API key
app.delete("/remove-key", async (req, res) => {
    const apiKey = req.query.apikey; // Get API key from query parameter
    const ownerId = req.query.ownerId; // Get owner ID from query parameter

    if (!apiKey) {
        return res.json("need parameter apikey");
    }

    // Remove the API key from MongoDB
    const result = await ApiKey.deleteOne({ key: apiKey, ownerId: ownerId });
    if (result.deletedCount > 0) {
        return res.json({ message: `API key ${apiKey} removed.` });
    } else {
        return res.json("invalid API key");
    }
});


// List all API keys by type
app.get("/list-keys", async (req, res) => {
    try {
        const basicKeys = await ApiKey.find({ type: "basic" });
        const proKeys = await ApiKey.find({ type: "pro" });

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
