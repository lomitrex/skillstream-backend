import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pgPool } from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_access_secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, role } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password required' });
        return;
      }

      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const userRole = role || 'student';

      const queryText = 'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role;';
      const result = await pgPool.query(queryText, [email, hashedPassword, userRole]);

      res.status(201).json(result.rows[0]);
    } catch (error: unknown) {

      if (typeof error === 'object' && error !== null && 'code' in error) {
        if ((error as any).code === '23505') {
          res.status(409).json({ error: 'Email already exists' });
          return;
        }
      }
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const queryText = 'SELECT * FROM users WHERE email = $1;';
      const result = await pgPool.query(queryText, [email]);

      if (result.rows.length === 0) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const user = result.rows[0];
      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      
      const accessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      
      const refreshToken = jwt.sign(
        { id: user.id },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      
      await pgPool.query('UPDATE users SET refresh_token = $1 WHERE id = $2;', [refreshToken, user.id]);

      res.status(200).json({ accessToken, refreshToken });
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token required' });
        return;
      }

      
      let decoded: any;
      try {
        decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      } catch (err) {
        res.status(403).json({ error: 'Invalid or expired refresh token' });
        return;
      }

      
      const queryText = 'SELECT * FROM users WHERE id = $1 AND refresh_token = $2;';
      const result = await pgPool.query(queryText, [decoded.id, refreshToken]);

      if (result.rows.length === 0) {
        res.status(403).json({ error: 'Token is revoked or invalid' });
        return;
      }

      const user = result.rows[0];

      
      const newAccessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      res.status(200).json({ accessToken: newAccessToken });
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}