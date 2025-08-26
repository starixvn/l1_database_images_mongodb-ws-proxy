import { Logger } from "@ldb/logger";
import net from "net";
import tls from "tls";
import { WebSocket, WebSocketServer } from "ws";
import { logger as defaultLogger } from "./logger.js";

/**
 * Connection options for establishing a socket connection
 */
interface ConnectionOptions {
    host: string;
    port: number;
    tls?: boolean;
    [key: string]: unknown;
}

/**
 * Creates a simple passthrough proxy that accepts a websocket connection and
 * establishes a corresponding socket connection to a server. The connection
 * flow starts by the frontend sending a connection options message after which
 * every follow-up message is directly written to the opened socket stream
 */
function createWebSocketProxy(port = 1337, logger: Logger = defaultLogger): WebSocketServer {
    const wsServer = new WebSocketServer({ host: "localhost", port }, () => {
        logger.logInfo({ title: "ws-proxy", message: `ws server listening at ws://${wsServer.options.host}:${wsServer.options.port}` });
    });

    const SOCKET_ERROR_EVENT_LIST = ["error", "close", "timeout", "parseError"];

    wsServer.on("connection", (ws: WebSocket) => {
        let socket: net.Socket | tls.TLSSocket | undefined;
        logger.logInfo({ title: "ws-proxy", message: `new ws connection (total ${wsServer.clients.size})` });

        ws.on("close", () => {
            logger.logInfo({ title: "ws-proxy", message: "ws closed" });
            if (socket) {
                socket.removeAllListeners();
                socket.end();
            }
        });

        ws.on("message", async (data: Buffer) => {
            if (socket) {
                socket.write(decodeMessageWithTypeByte(data), "binary");
            } else {
                // First message before socket is created is with connection info
                const { tls: useSecureConnection, ...connectOptions } = decodeMessageWithTypeByte(data) as unknown as ConnectionOptions;

                logger.logInfo({
                    title: "ws-proxy",
                    message: `setting up new${useSecureConnection ? " secure" : ""} connection to ${connectOptions.host}:${connectOptions.port}`,
                });

                socket = useSecureConnection
                    ? tls.connect({
                          servername: connectOptions.host,
                          ...connectOptions,
                      })
                    : net.createConnection(connectOptions);

                socket.setKeepAlive(true, 300000);
                socket.setTimeout(30000);
                socket.setNoDelay(true);

                const connectEvent = useSecureConnection ? "secureConnect" : "connect";

                SOCKET_ERROR_EVENT_LIST.forEach((evt) => {
                    socket?.on(evt, (err) => {
                        logger.logError({ title: "ws-proxy", message: `server socket error event (${evt})` }, { extra: { error: err } });
                        ws.close(evt === "close" ? 1001 : 1011);
                    });
                });

                socket.on(connectEvent, () => {
                    logger.logInfo({ title: "ws-proxy", message: `server socket connected at ${connectOptions.host}:${connectOptions.port}` });
                    socket?.setTimeout(0);
                    const encoded = encodeStringMessageWithTypeByte(JSON.stringify({ preMessageOk: 1 }));
                    ws.send(encoded);
                });

                socket.on("data", async (data: Buffer) => {
                    ws.send(encodeBinaryMessageWithTypeByte(data));
                });
            }
        });
    });

    return wsServer;
}

function encodeStringMessageWithTypeByte(message: string): Uint8Array {
    const utf8Encoder = new TextEncoder();
    const utf8Array = utf8Encoder.encode(message);
    return encodeMessageWithTypeByte(utf8Array, 0x01);
}

function encodeBinaryMessageWithTypeByte(message: Buffer | Uint8Array): Uint8Array {
    return encodeMessageWithTypeByte(message, 0x02);
}

function encodeMessageWithTypeByte(message: Buffer | Uint8Array, type: number): Uint8Array {
    const encoded = new Uint8Array(message.length + 1);
    encoded[0] = type;
    encoded.set(new Uint8Array(message), 1);
    return encoded;
}

function decodeMessageWithTypeByte(message: Buffer | Uint8Array): Uint8Array<ArrayBufferLike> {
    const typeByte = message[0];
    if (typeByte === 0x01) {
        const jsonBytes = message.subarray(1);
        const textDecoder = new TextDecoder("utf-8");
        const jsonStr = textDecoder.decode(jsonBytes);
        return JSON.parse(jsonStr);
    } else if (typeByte === 0x02) {
        return message.subarray(1);
    }
    return new Uint8Array(0);
}

export { createWebSocketProxy };
