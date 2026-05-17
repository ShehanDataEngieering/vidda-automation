/**
 * Quick debug — verify auth mock
 */
import { config } from 'dotenv';
config();

const authModule = require('../middleware/auth');
authModule.requireSignedIn = ((req: any, _res: any, next: any) => {
  req.auth = () => ({
    userId: 'e2e-user',
    sessionId: 's1',
    tokenType: 'session',
    sessionClaims: {
      sub: 'e2e-user', sid: 's1',
      publicMetadata: { role: 'admin', companyId: 'e2e-co', employeeRole: null },
    },
    getToken: () => Promise.resolve('t'),
  });
  next();
}) as any;
authModule.requireRole = () => (_req: any, _res: any, next: any) => next();

import { pipelineRouter } from '../routes/pipeline';
import express from 'express';
import request from 'supertest';

const app = express();
app.use(express.json());
app.use('/api/pipeline', pipelineRouter);

request(app)
  .post('/api/pipeline')
  .send({})
  .end((_err: any, res: any) => {
    console.log('Status:', res.status, 'Body:', JSON.stringify(res.body));
    process.exit(0);
  });
