import { logger } from "./logger.js";
import { metadata } from "./metadata.js";
import { createWebSocketProxy } from "./ws-proxy.js";

// Default port, can be overridden by environment variable
const PORT = parseInt(process.env.WS_PROXY_PORT || "1337", 10);

function shutdown(wsServer: ReturnType<typeof createWebSocketProxy>, code = 0) {
    logger.logInfo({
        title: "server",
        message: `Shutting down ${metadata.name} v${metadata.version}`,
    });

    // Close all WebSocket connections
    wsServer.clients.forEach((client) => {
        client.terminate();
    });

    // Close the WebSocket server
    wsServer.close(() => {
        logger.logInfo({
            title: "server",
            message: "WebSocket server closed successfully",
        });

        // Allow any remaining logs to be written
        setTimeout(() => {
            process.exit(code);
        }, 500);
    });
}

async function main() {
    logger.logInfo({
        title: "server",
        message: `Starting ${metadata.name} v${metadata.version}`,
    });

    // Create and start the WebSocket proxy server
    const wsServer = createWebSocketProxy(PORT, logger);

    // Handle process signals for graceful shutdown
    process.on("SIGINT", () => {
        logger.logInfo({ title: "server", message: "Received SIGINT signal" });
        shutdown(wsServer);
    });

    process.on("SIGTERM", () => {
        logger.logInfo({ title: "server", message: "Received SIGTERM signal" });
        shutdown(wsServer);
    });

    // Handle uncaught exceptions and unhandled promise rejections
    process.on("uncaughtException", (error) => {
        logger.logError({ title: "server", message: "Uncaught exception" }, { extra: { error } });
        shutdown(wsServer, 1);
    });

    process.on("unhandledRejection", (reason, promise) => {
        logger.logError({ title: "server", message: "Unhandled promise rejection" }, { extra: { reason, promise } });
        shutdown(wsServer, 1);
    });
}

// Run the application
main().catch((error) => {
    logger.logError({ title: "server", message: "Failed to start application" }, { extra: { error } });
    process.exit(1);
});
