import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { pgPool } from '../config/db';

const ACCESS_SECRET = process.env.JWT_SECRET || 'access_secret_key_2026';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh_secret_key_2026';

// Dummy hash to normalize timing against user enumeration
const DUMMY_HASH = '$2b$10$wT8B6W3q4B8B6W3q4B8B6.3fXU/nO9YlYt3pYt1QzV0S4nL3P4H4e';

export interface UserSession {
  id: number;
  email: string;
  role: string;
}

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 mins
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie('access_token');
  res.clearCookie('refresh_token', { path: '/api/v1/auth' });
};

export class AuthService {
  static async register(email: string, passwordPlain: string, requestedRole = 'student') {
    // Prevent vertical privilege escalation at registration
    const role = requestedRole === 'admin' ? 'student' : requestedRole;

    const existing = await pgPool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount && existing.rowCount > 0) {
      throw { status: 409, code: 'EMAIL_EXISTS', message: 'Email already registered' };
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(passwordPlain, salt);

    const result = await pgPool.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, role, created_at`,
      [email, passwordHash, role]
    );

    return result.rows[0];
  }

  static async login(email: string, passwordPlain: string) {
    const userRes = await pgPool.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
      [email]
    );

    const user = userRes.rows[0];
    const targetHash = user ? user.password_hash : DUMMY_HASH;

    // Timing-attack safe comparison
    const passwordMatch = await bcrypt.compare(passwordPlain, targetHash);

    if (!user || !passwordMatch) {
      throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' };
    }

    return this.generateTokenSession(user);
  }

  static async generateTokenSession(user: UserSession, existingFamilyId?: string) {
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = hashToken(rawRefreshToken);
    const familyId = existingFamilyId || crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pgPool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, tokenHash, familyId, expiresAt]
    );

    return {
      user: { id: user.id, email: user.email, role: user.role },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  static async rotateRefreshToken(incomingRawToken: string) {
    const incomingHash = hashToken(incomingRawToken);

    const tokenRes = await pgPool.query(
      `SELECT r.id, r.user_id, r.family_id, r.is_revoked, r.expires_at, u.email, u.role
       FROM refresh_tokens r
       JOIN users u ON u.id = r.user_id
       WHERE r.token_hash = $1`,
      [incomingHash]
    );

    if (tokenRes.rowCount === 0) {
      throw { status: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token unrecognized' };
    }

    const tokenRecord = tokenRes.rows[0];

    // Reuse detection: If token was already revoked, invalidate the entire token family
    if (tokenRecord.is_revoked) {
      await pgPool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE family_id = $1', [
        tokenRecord.family_id,
      ]);
      throw {
        status: 403,
        code: 'TOKEN_REUSE_DETECTED',
        message: 'Compromised token session. All sessions invalidated.',
      };
    }

    if (new Date() > new Date(tokenRecord.expires_at)) {
      throw { status: 401, code: 'TOKEN_EXPIRED', message: 'Refresh token has expired' };
    }

    // Invalidate the current token (Single-Use Enforced)
    await pgPool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE id = $1', [
      tokenRecord.id,
    ]);

    // Issue a new token pair within the same family
    const userSession: UserSession = {
      id: tokenRecord.user_id,
      email: tokenRecord.email,
      role: tokenRecord.role,
    };

    return this.generateTokenSession(userSession, tokenRecord.family_id);
  }
}