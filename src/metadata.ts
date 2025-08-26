import type { Metadata } from "@ldb/utils";

export const name = "mongodb-ws-proxy" as const;
export const version = "0.1.0" as const;

export const metadata = { name, version } as const satisfies Metadata;
