import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { config } from '../config.js';
import { activeDatabaseUrl } from '../knexConfig.js';

const PgStore = connectPgSimple(session);

export const SESSION_COOKIE = 'sid';

export const sessionStore = new PgStore({
  conString: activeDatabaseUrl,
  tableName: 'session',
});

export const sessionMiddleware = session({
  name: SESSION_COOKIE,
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

declare module 'express-session' {
  interface SessionData {
    teacherId?: string;
  }
}
