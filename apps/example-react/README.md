# Example React Dashboard

A minimal React dashboard that uses [@ntcore-ts/react](../../packages/react) to display and control NetworkTables topics from [example-robot](../example-robot) (Java FRC). The same robot binary is also the NT server fixture for [example-client](../example-client) e2e tests, so it publishes extra scalar, Waypoint, and echo topics beyond what this dashboard shows.

## Run with the robot (local simulation)

1. **Start the robot** (NT server on port 5810):

   ```bash
   cd apps/example-robot && ./gradlew simulateJava
   ```

   Or from the repo root: `nx run example-robot:serve` (if that target is configured).

2. **Serve the dashboard**:

   ```bash
   nx run example-react:serve
   ```

   Open the URL shown (e.g. http://localhost:4200).

3. The dashboard shows:

   - **Connection status** — click to reopen the connection overlay after the first connect.
   - **Connection overlay** — shown until the first successful connect (unless dismissed). Team number or address/port fields seed from the current NT client when available. Escape or Close resumes auto-connect.
   - **Sensors** — Gyro and Accelerometer X/Y.
   - **Pose** — protobuf `/MyTable/Pose` with a top-down field view.
   - **Pose (Struct)** — struct `/MyTable/PoseStruct` (`Pose2d`) with the same visualization.
   - **Auto Mode** — subscribe and publish `/MyTable/AutoMode` (retained string).
   - **All topics** — live table of every announced topic under `/`.

## Environment

- `VITE_NT_URI` – NetworkTables server host (default: `localhost`).
- `VITE_NT_PORT` – NetworkTables server port (default: `5810`).

Example for a real robot: `VITE_NT_URI=10.9.73.2 nx run example-react:serve` (SystemCore) or `VITE_NT_URI=roborio-973-frc.local nx run example-react:serve` (RoboRIO).
