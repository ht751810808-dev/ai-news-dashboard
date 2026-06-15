#!/bin/bash
cd "$(dirname "$0")"
lsof -ti:4321 | xargs kill -9 2>/dev/null
node server.js &
sleep 2
open http://localhost:4321
wait
