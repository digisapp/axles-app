import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '@/lib/logger';

describe('logger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('logger.error calls console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('test error');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('[ERROR]');
    expect(spy.mock.calls[0][0]).toContain('test error');
  });

  it('logger.warn calls console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('test warning');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('[WARN]');
  });

  it('logger.info calls console.info', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logger.info('test info');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('[INFO]');
  });

  it('logger.debug calls console.debug in dev', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    logger.debug('test debug');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('[DEBUG]');
  });

  it('includes context in output', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('operation failed', { userId: '123', action: 'delete' });
    expect(spy.mock.calls[0][0]).toContain('operation failed');
    expect(spy.mock.calls[0][0]).toContain('"userId":"123"');
    expect(spy.mock.calls[0][0]).toContain('"action":"delete"');
  });

  it('omits context when none provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('simple message');
    // Should not have extra JSON object
    expect(spy.mock.calls[0][0]).toBe('[ERROR] simple message');
  });
});
