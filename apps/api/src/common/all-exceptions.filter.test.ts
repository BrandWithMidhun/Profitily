import { type ArgumentsHost, BadRequestException } from '@nestjs/common';
import type { Logger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';

import { AllExceptionsFilter } from './all-exceptions.filter.js';

function mockHost() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

const logger = { error: vi.fn() } as unknown as Logger;

describe('AllExceptionsFilter', () => {
  it('returns a generic 500 for unknown errors and logs detail server-side', () => {
    const { host, status, json } = mockHost();
    new AllExceptionsFilter(logger).catch(new Error('boom secret detail'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it('never leaks the internal 500 message to the client', () => {
    const { host, json } = mockHost();
    new AllExceptionsFilter(logger).catch(new Error('boom secret detail'), host);

    const body = json.mock.calls[0]?.[0] as { message: string };
    expect(body.message).not.toContain('secret');
  });

  it('passes a 4xx HttpException message through', () => {
    const { host, status, json } = mockHost();
    new AllExceptionsFilter(logger).catch(
      new BadRequestException('bad input'),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: 'bad input' }),
    );
  });
});
