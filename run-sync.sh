#!/bin/bash
unzip -o sync.zip -d /opt/sub-manager
cd /opt/sub-manager
deno run -A --env sync-clients.ts
