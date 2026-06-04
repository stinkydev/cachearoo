import * as fs from 'fs';
import { Request, Response, NextFunction } from 'express';

let deviceId: string;

function uuid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
};

export function generateOrLoadDeviceID() {
  const fn = '.deviceid';
  try {
    const data = fs.readFileSync(fn);
    deviceId = data.toString();
  } catch (e) {
    deviceId = uuid();
    fs.writeFileSync(fn, deviceId);
  }
}

export function getDeviceId() {
  return deviceId;
}

export function serveDeviceId(req: Request, res: Response, next: NextFunction) {
  res.json({ id: deviceId });
}
