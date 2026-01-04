import { jest } from '@jest/globals';
import { authenticate, optionalAuth } from '../src/middleware/auth';
import { generateAccessToken } from '../src/utils/jwt';

describe('auth middleware', () => {
  const mockReply = () => {
    const result: any = {
      statusCode: undefined as number | undefined,
      payload: undefined as any,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      send(body: any) {
        this.payload = body;
        return this;
      },
    };
    return result;
  };

  it('returns 401 when authorization header is missing', async () => {
    const reply = mockReply();
    await authenticate({ headers: {} } as any, reply as any);

    expect(reply.statusCode).toBe(401);
    expect(reply.payload?.error?.code).toBe('UNAUTHORIZED');
  });

  it('sets user on valid token', async () => {
    const payload = { userId: '123', email: 't@example.com' };
    const token = generateAccessToken(payload as any);
    const request: any = { headers: { authorization: 'Bearer token123' } };
    request.headers.authorization = `Bearer ${token}`;
    const reply = mockReply();

    await authenticate(request as any, reply as any);

    expect(request.user).toEqual(expect.objectContaining(payload));
    expect(reply.statusCode).toBeUndefined();
  });

  it('returns 401 on invalid token', async () => {
    const reply = mockReply();
    await authenticate({ headers: { authorization: 'Bearer bad' } } as any, reply as any);

    expect(reply.statusCode).toBe(401);
    expect(reply.payload?.error?.code).toBe('INVALID_TOKEN');
  });

  it('optionalAuth sets user when valid and ignores invalid tokens', async () => {
    const payload = { userId: '456', email: 'x@example.com' };
    const token = generateAccessToken(payload as any);

    const reqValid: any = { headers: { authorization: `Bearer ${token}` } };
    await optionalAuth(reqValid as any, {} as any);
    expect(reqValid.user).toEqual(expect.objectContaining(payload));

    const reqInvalid: any = { headers: { authorization: 'Bearer bad' } };
    await optionalAuth(reqInvalid as any, {} as any);
    expect(reqInvalid.user).toBeUndefined();
  });
});
