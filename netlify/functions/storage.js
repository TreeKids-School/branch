const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
    const store = getStore("care-record-pro-data");
    const method = event.httpMethod;
    const path = event.path.split("/").pop(); // Simple routing if needed, but we'll use query params or body

    let body = {};
    if (method === "POST" || method === "DELETE") {
        try {
            body = JSON.parse(event.body || "{}");
        } catch (e) {
            return { statusCode: 400, body: "Invalid JSON" };
        }
    }

    const { action, key, data, childId, messageId, date } = body.action ? body : (event.queryStringParameters || {});

    try {
        switch (action) {
            case "getChildren":
                const children = await store.get("children", { type: "json" }) || [];
                return { statusCode: 200, body: JSON.stringify(children) };

            case "setChildren":
                await store.setJSON("children", data);
                return { statusCode: 200, body: JSON.stringify({ status: "OK" }) };

            case "getMessages":
                const messages = await store.get(`messages_${childId}`, { type: "json" }) || [];
                return { statusCode: 200, body: JSON.stringify(messages) };

            case "saveMessages":
                await store.setJSON(`messages_${childId}`, data);
                return { statusCode: 200, body: JSON.stringify({ status: "OK" }) };

            case "getReport":
                const report = await store.get(`report_${date}`, { type: "json" }) || null;
                return { statusCode: 200, body: JSON.stringify(report) };

            case "saveReport":
                await store.setJSON(`report_${date}`, data);
                // Update index
                let index = await store.get("reports_index", { type: "json" }) || [];
                if (!index.includes(date)) {
                    index.push(date);
                    await store.setJSON("reports_index", index);
                }
                return { statusCode: 200, body: JSON.stringify({ status: "OK" }) };

            case "getReportIndex":
                const reportIndex = await store.get("reports_index", { type: "json" }) || [];
                return { statusCode: 200, body: JSON.stringify(reportIndex) };

            default:
                return { statusCode: 400, body: JSON.stringify({ error: "Unknown Action" }) };
        }
    } catch (error) {
        console.error("Storage Logic Error:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
