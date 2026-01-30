#!/usr/bin/env bash
# Starts example-robot (NT server), waits for readiness, runs example-client E2E, then stops the robot.
# Builds are run by Nx when using: nx run example-client:e2e:local  or  npm run e2e:local
# Set E2E_HEADLESS=1 (e.g. in CI) to run the robot under xvfb.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

echo "Starting example-robot (NT server) in background..."
chmod +x apps/example-robot/gradlew 2>/dev/null || true
# Run in process group so we can kill the whole tree (gradlew + Java simulation)
set -m
if [ -n "$E2E_HEADLESS" ] && command -v xvfb-run >/dev/null 2>&1; then
  (cd apps/example-robot && xvfb-run ./gradlew simulateJava) &
else
  (cd apps/example-robot && ./gradlew simulateJava) &
fi
ROBOT_PID=$!
set +m

cleanup() {
  echo "Stopping example-robot (PID $ROBOT_PID)..."
  kill -TERM -$ROBOT_PID 2>/dev/null || true
  exit "${1:-0}"
}
trap 'cleanup $?' EXIT INT TERM

echo "Waiting for NT server on localhost:5810..."
for i in $(seq 1 60); do
  if (command -v nc >/dev/null 2>&1 && nc -z localhost 5810 2>/dev/null) || \
     (command -v timeout >/dev/null 2>&1 && timeout 1 bash -c "echo >/dev/tcp/localhost/5810" 2>/dev/null); then
    echo "NT server port open (after ${i}s)."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Timeout waiting for NT server on port 5810."
    cleanup 1
  fi
  sleep 0.5
done

# Wait for server to accept WebSocket (curl upgrade gets 101/4xx) or fall back to short sleep
echo "Waiting for NT server to accept connections..."
if command -v curl >/dev/null 2>&1; then
  for i in $(seq 1 20); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 --max-time 3 \
      -H "Connection: Upgrade" -H "Upgrade: websocket" \
      -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" -H "Sec-WebSocket-Version: 13" \
      "http://127.0.0.1:5810/nt/ready" 2>/dev/null || true)
    if echo "$code" | grep -qE '^101|[45][0-9]{2}$'; then
      echo "NT server ready (after ${i} probe(s))."
      break
    fi
    if [ "$i" -eq 20 ]; then
      echo "Probe timed out; continuing with 1s delay."
      sleep 1
    fi
    sleep 0.5
  done
else
  echo "curl not found; sleeping 1s."
  sleep 1
fi

echo "Running E2E tests..."
# Run vitest directly so test output is shown (Nx vitest executor buffers output)
set +e
npx vitest run --config apps/example-client/vitest.e2e.config.ts
E2E_EXIT=$?
set -e
cleanup $E2E_EXIT
