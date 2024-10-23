const headers = {
    "origin": "https://gateway.platoboost.com",
    "referer": "https://gateway.platoboost.com/",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
};

async function mkbas(url) {
    try {
        // Validasi URL
        const h = new URL(url); // Memastikan URL valid

        const id = h.searchParams.get("id");
        if (!id) {
            throw new Error("ID parameter is missing in the URL");
        }

        const response = await fetch(`https://api-gateway.platoboost.com/v1/authenticators/8/${id}`, { headers: headers });
        const data = await response.json();
        
        const key = data.key;
        const time = data.minutesLeft;
        return { key, time };
    } catch (error) {
        console.error("Error in mkbas:", error);
        throw error; // Mengembalikan error untuk ditangani di tempat lain
    }
}

module.exports = mkbas;
