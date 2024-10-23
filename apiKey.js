// ApiKey.js
const mongoose = require("mongoose");

const apiKeySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    type: { type: String, required: true }, // 'basic' or 'pro'
    requestCount: { type: Number, default: 0 },
    ownerId: { type: String, required: true } // To associate keys with users
});

const ApiKey = mongoose.model("ApiKey", apiKeySchema);
module.exports = ApiKey;
