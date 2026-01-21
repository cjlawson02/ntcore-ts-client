import {
  LogLevel,
  getLogger,
  getModuleLogLevel,
  setLogLevel,
  setModuleLogLevel,
  socketLogger,
  messengerLogger,
} from './logger';

describe('logger utilities', () => {
  beforeEach(() => {
    setLogLevel(LogLevel.INFO);
  });

  it('setLogLevel should recreate existing module loggers', () => {
    const socket1 = getLogger('socket');
    const messenger1 = getLogger('messenger');

    setLogLevel(LogLevel.ERROR);

    const socket2 = getLogger('socket');
    const messenger2 = getLogger('messenger');

    expect(socket2).not.toBe(socket1);
    expect(messenger2).not.toBe(messenger1);
    expect(getModuleLogLevel('socket')).toBe(LogLevel.ERROR);
    expect(getModuleLogLevel('messenger')).toBe(LogLevel.ERROR);
  });

  it('setModuleLogLevel should only affect the specified module', () => {
    // Create modules first so we can observe changes.
    getLogger('socket');
    getLogger('messenger');

    setLogLevel(LogLevel.INFO);
    setModuleLogLevel('socket', LogLevel.DEBUG);

    expect(getModuleLogLevel('socket')).toBe(LogLevel.DEBUG);
    expect(getModuleLogLevel('messenger')).toBe(LogLevel.INFO);
  });

  it('getModuleLogLevel should map minLevel=0 (tslog silly) to TRACE', () => {
    const logger = getLogger('socket');
    (logger.settings as unknown as { minLevel: number }).minLevel = 0;

    expect(getModuleLogLevel('socket')).toBe(LogLevel.TRACE);
  });

  it('proxy loggers should bind methods and reflect updated settings', () => {
    // Method binding: extracting the method should still work.
    const info = socketLogger.info;
    expect(() => info('hello')).not.toThrow();

    setModuleLogLevel('socket', LogLevel.FATAL);
    expect(socketLogger.settings.minLevel).toBe(LogLevel.FATAL);

    // Ensure other proxies are also functional and can access values.
    expect(typeof messengerLogger.debug).toBe('function');
    expect(messengerLogger.settings).toBeDefined();
  });
});
