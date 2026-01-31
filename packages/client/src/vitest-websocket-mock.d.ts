/**
 * Type augmentation for vitest-websocket-mock custom matchers.
 * The package's WSMock adds toReceiveMessage() for assertions; ensure it is typed.
 */
declare module 'vitest' {
  interface Assertion {
    toReceiveMessage(message: string): Promise<void>;
  }
}
