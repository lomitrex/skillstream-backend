import { describe, it, expect, afterAll, beforeAll } from '@jest/globals';
import request from 'supertest';
import { app, server } from '../src/server';
import mongoose from 'mongoose';
import { pgPool, initPgDb } from '../src/config/db';
import { redisClient, connectRedis } from '../src/config/redis';
import { connectMongo } from '../src/config/mongo';


describe('SkillStream End-to-End API Integration Suite', () => {
  let adminAccessToken: string;
  let adminRefreshToken: string;
  let studentAccessToken: string;
  let targetCourseId: string;

  beforeAll(async () => {
    
    await initPgDb();
    await connectMongo();
    await connectRedis();

    
    await pgPool.query('DROP TABLE IF EXISTS users CASCADE;');
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'student',
        refresh_token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pgPool.query(createTableQuery);
  });

  afterAll(async () => {
    
    await mongoose.disconnect();
    await pgPool.end();
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
    server.close();
  });

  
  
  
  describe('Auth Endpoints', () => {
    it('should successfully register an admin user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'testadmin@poc-platform.com',
          password: 'securepassword123',
          role: 'admin'
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.role).toBe('admin');
    });

    it('should successfully register a default student user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'student@poc-platform.com',
          password: 'studentpassword123'
        });
      expect(res.status).toBe(201);
      expect(res.body.role).toBe('student');
    });

    it('should reject registration with an existing email (OWASP/DB Constraints)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'testadmin@poc-platform.com',
          password: 'anotherpassword'
        });
      expect(res.status).toBe(409);
    });

    it('should authenticate users and yield an access/refresh token pair', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'testadmin@poc-platform.com',
          password: 'securepassword123'
        });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      
      adminAccessToken = res.body.accessToken;
      adminRefreshToken = res.body.refreshToken;
    });

    it('should log in student to acquire student access credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'student@poc-platform.com',
          password: 'studentpassword123'
        });
      studentAccessToken = res.body.accessToken;
    });

    it('should rotate access tokens using a valid refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: adminRefreshToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });
  });

  
  
  
  describe('Course Catalog Endpoints', () => {
    it('should deny course additions to unauthorized anonymous requests', async () => {
      const res = await request(app)
        .post('/api/v1/courses')
        .send({ title: 'Anonymous Threat' });
      expect(res.status).toBe(401);
    });

    it('should block regular students from accessing instructor features (RBAC)', async () => {
      const res = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${studentAccessToken}`)
        .send({
          title: 'Illegal Course Attempt',
          description: 'Hacking the framework',
          instructor: 'Malicious'
        });
      expect(res.status).toBe(403);
    });

    it('should allow verified admins to create new courses', async () => {
      const res = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          title: 'Advanced Node.js Production Architecture',
          description: 'Mastering performance mechanics',
          instructor: 'Lead Engineer'
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('_id');
      targetCourseId = res.body._id;
    });

    it('should fetch the course list successfully via authenticated request', async () => {
      const res = await request(app)
        .get('/api/v1/courses')
        .set('Authorization', `Bearer ${adminAccessToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  
  
  
  describe('Context Reviews & Webhook Handling', () => {
    it('should attach a course review using metadata extracted from user session token', async () => {
      const res = await request(app)
        .post('/api/v1/reviews')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send({
          courseId: targetCourseId,
          rating: 5,
          comment: 'Outstanding backend architecture blueprint!'
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('userId');
    });

    it('should successfully accept mobile synchronization requests via webhook headers', async () => {
      const res = await request(app)
        .post('/api/v1/webhooks/mobile-sync')
        .set('x-sync-signature', 'mobile_secure_tracking_signature')
        .send({ deviceId: 'mob_device_99', action: 'force_delta_refresh' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('synced');
    });
  });
});