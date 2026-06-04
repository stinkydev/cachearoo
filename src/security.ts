import { Request, Response, NextFunction } from 'express';
import { config } from './config';

const basicAuth = require('basic-auth');
const users = config.getUsers();

export function authentication(req: Request, res: Response, next: NextFunction) {
  if ((users === null) || (users.length === 0)) return next();

  function unauthorized(res: Response) {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.status(401).end();
  }

  const user = basicAuth(req);

  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  }
  for (const i in users) {
    if (user.name === users[i].name && user.pass === users[i].pass) {
      return next();
    }
  }
  return unauthorized(res);
}

export function checkAPIKey(req: Request, res: Response, next: NextFunction) {
  if (config.apiKey) {
    if (req.header('API-Key') !== config.apiKey) {
      if ((!config.publicRead) || (req.method !== 'GET')) {
        res.status(401).send('401 Unauthorized');
        return;
      }
    }
  }
  next();
}

export function apiKeyOrAuthenticate(req: Request, res: Response, next: NextFunction) {
  if ((req.header('API-Key')) && (req.header('API-Key') !== '')) {
    exports.checkAPIKey(req, res, next);
  } else {
    exports.authentication(req, res, next);
  }
}
