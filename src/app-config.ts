import { LumiLoggerConfig } from "@ldb/logger";
import { metadata } from "./metadata.js";

const { name, version } = metadata;

export const environment = "DEV" as const;

export const lumiLoggerConfig = {
    sentryNodeOptions: {
        dsn: "https://e83926b2bc60caab91f825f6fce3d658@sentry-k8s.lumigame.com/24",
        environment,
        initialScope: {
            tags: { service: name },
        },
        release: `${name}@${version}`,
    },
    skynexOptions: {
        conversationIds: {
            telegram: -1002034115006,
            slack: "B08GPPK88MS:T08ACMHMMFS:C091FAL49UG",
        },
    },
    environment,
    terminalSeverityLevel: "debug",
} as const satisfies LumiLoggerConfig;
