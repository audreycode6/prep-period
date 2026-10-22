import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { config } from '../config.js';
import { activeDatabaseUrl } from '../knexConfig.js';

const PgStore = connectPgSimple(session);

export const sessionStore = new PgStore({
  conString: activeDatabaseUrl,
  tableName: 'session',
});

export const sessionMiddleware = session({
  store: sessionStore,
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
  },
});
