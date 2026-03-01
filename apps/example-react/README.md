# Example React Dashboard

A minimal React dashboard that uses [@ntcore/react](../../packages/react) to display and control NetworkTables topics from [example-robot](../example-robot) (Java FRC).

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

3. The dashboard shows connection status, Gyro, Accelerometer X/Y, Pose (protobuf), and Auto Mode. You can change Auto Mode from the dropdown; the robot reads it in `autonomousInit()`.

## Environment

- `VITE_NT_URI` – NetworkTables server host (default: `localhost`).
- `VITE_NT_PORT` – NetworkTables server port (default: `5810`).

Example for a real robot: `VITE_NT_URI=roborio-973-frc.local nx run example-react:serve`.
