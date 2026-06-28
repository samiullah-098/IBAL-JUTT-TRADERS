import serverless from 'serverless-http';
import { app } from '../../backend/index';

export const handler = serverless(app, {
  basePath: '/.netlify/functions/api'
});
