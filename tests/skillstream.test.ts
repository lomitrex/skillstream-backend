import { describe, it, expect, afterAll, beforeAll } from '@jest/globals';
import request from 'supertest';
import { app, server } from '../src/server';
import mongoose from 'mongoose';
import { pgPool, initPgDb } from '../src/config/db';
import { redisClient, connectRedis } from '../src/config/redis';
import { connectMongo } from '../src/config/mongo';
import { Course } from '../src/models/course.model';

describe('SkillStream Production Security & Resilience Suite', () => {
  let studentCookie: string;
  let adminAccessToken: string;
  let firstRefreshToken: string;
  let rotatedRefreshToken: string;

  beforeAll(async () => {
    await initPgDb();
    await connectMongo();
    await connectRedis();

    // Clean test state
    await pgPool.query('DROP TABLE IF EXISTS refresh_tokens CASCADE;');
    await pgPool.query('DROP TABLE IF EXISTS users CASCADE;');
    await initPgDb();
    await Course.deleteMany({});
    await redisClient.flushAll();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await pgPool.end();
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
    server.close();
  });

  describe('1. Privilege Escalation Guards', () => {
    it('prevents vertical privilege escalation during registration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'attacker@test.com',
          password: 'Password123!',
          role: 'admin', // Tampering attempt
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('student'); // Force-demoted to student
    });
  });

  describe('2. Single-Use Refresh Token Rotation & Reuse Detection', () => {
    it('authenticates and sets SameSite=Strict cookies', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'attacker@test.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("refreshToken");

      firstRefreshToken = res.body.data.refreshToken;

      const rawCookies = res.headers["set-cookie"];
      const cookies: string[] = Array.isArray(rawCookies)
        ? rawCookies
        : typeof rawCookies === "string"
          ? [rawCookies]
          : [];

      expect(cookies.some((c: string) => c.includes("SameSite=Strict"))).toBe(
        true,
      );
      expect(cookies.some((c: string) => c.includes("HttpOnly"))).toBe(true);
    });

    it('rotates the refresh token successfully on first use', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: firstRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      rotatedRefreshToken = res.body.data.refreshToken;
      expect(rotatedRefreshToken).not.toBe(firstRefreshToken);
    });

    it('detects refresh token reuse and immediately invalidates the token family', async () => {
      // Attacker replays firstRefreshToken
      const replayRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: firstRefreshToken });

      expect(replayRes.status).toBe(403);
      expect(replayRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');

      // Legitimate user attempts to use rotatedRefreshToken - must now fail because family was revoked
      const legitRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotatedRefreshToken });

      expect(legitRes.status).toBe(403);
      expect(legitRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');
    });
  });

  describe('3. Redis Idempotency Pattern', () => {
    let adminToken: string;

    beforeAll(async () => {
      // Seed verified admin directly in Postgres
      await pgPool.query(
        `INSERT INTO users (email, password_hash, role)
         VALUES ('admin@platform.com', '$2b$12$DUMMY_HASH_SECURE', 'admin')`
      );

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'attacker@test.com', password: 'Password123!' });
      studentCookie = loginRes.body.data.accessToken;

      // Authorize admin
      const jwt = require('jsonwebtoken');
      adminToken = jwt.sign(
        { id: 99, email: 'admin@platform.com', role: 'admin' },
        process.env.JWT_SECRET || 'access_secret_key_2026',
        { expiresIn: '1h' }
      );
    });

    it('returns the exact cached response on duplicate Idempotency-Key submission', async () => {
      const idempotencyKey = 'unique-idempotency-key-001';

      const firstCall = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Idempotency-Key', idempotencyKey)
        .send({
          title: 'Distributed Systems with Node.js',
          description: 'Production architecture',
        });

      expect(firstCall.status).toBe(201);
      const originalCourseId = firstCall.body.data._id;

      // Second identical request
      const secondCall = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Idempotency-Key', idempotencyKey)
        .send({
          title: 'Distributed Systems with Node.js',
          description: 'Production architecture',
        });

      expect(secondCall.status).toBe(201);
      expect(secondCall.headers['x-cache-hit']).toBe('true');
      expect(secondCall.body.data._id).toBe(originalCourseId);

      // Verify no duplicate record was created in MongoDB
      const count = await Course.countDocuments({ title: 'Distributed Systems with Node.js' });
      expect(count).toBe(1);
    });
  });

  describe('4. Pagination, Filtering, and Uniform Response Envelopes', () => {
    let adminToken: string;

    beforeAll(async () => {
      const jwt = require('jsonwebtoken');
      adminToken = jwt.sign(
        { id: 99, email: 'admin@platform.com', role: 'admin' },
        process.env.JWT_SECRET || 'access_secret_key_2026'
      );

      // Seed courses
      await Course.create([
        { title: 'TypeScript Core', description: 'Language fundamentals', instructor: 'admin@platform.com' },
        { title: 'Advanced Docker', description: 'Container workflows', instructor: 'admin@platform.com' },
        { title: 'Kubernetes Scale', description: 'Cluster orchestration', instructor: 'admin@platform.com' },
      ]);
    });

    it('returns paginated and enveloped course listings', async () => {
      const res = await request(app)
        .get('/api/v1/courses?page=1&limit=2&sortBy=title&sortOrder=asc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('error', null);
      expect(res.body.meta).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 2,
          totalPages: expect.any(Number),
        })
      );
      expect(res.body.data.length).toBe(2);
    });

    it('filters courses by search parameter', async () => {
      const res = await request(app)
        .get('/api/v1/courses?search=Kubernetes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toBe('Kubernetes Scale');
    });
  });
});