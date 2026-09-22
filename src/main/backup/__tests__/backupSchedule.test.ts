import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultResume } from '@shared/resume/defaultResume';
import { openDatabase, type Database } from '../../db/connection';
import { createTemplate } from '../../db/templates';
import {
  buildBackupFileName,
  isBackupDue,
  parseBackupFrequency,
  readBackupStatus,
  runScheduledBackup,
  setBackupFolder,
  setBackupFrequency,
} from '../backupSchedule';

let db: Database;
let folder: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mosaic-backups-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(folder, { recursive: true, force: true });
});

const at = (day: number, hour: number) => new Date(2026, 8, day, hour).getTime();

describe('isBackupDue', () => {
  const daily = { frequency: 'daily' as const, folder: '/backups', lastRunAt: at(21, 9) };

  it('is never due while off or with no folder', () => {
    expect(isBackupDue({ ...daily, frequency: 'off', lastRunAt: null }, at(22, 9))).toBe(false);
    expect(isBackupDue({ ...daily, folder: null, lastRunAt: null }, at(22, 9))).toBe(false);
  });

  it('is due at once when nothing has been written yet', () => {
    expect(isBackupDue({ ...daily, lastRunAt: null }, at(21, 9))).toBe(true);
  });

  it('counts calendar days, so an earlier start the next morning is still a new day', () => {
    expect(isBackupDue(daily, at(21, 23))).toBe(false);
    expect(isBackupDue(daily, at(22, 8))).toBe(true);
  });

  it('waits seven days when weekly, and catches up however long Mosaic was closed', () => {
    const weekly = { ...daily, frequency: 'weekly' as const };
    expect(isBackupDue(weekly, at(27, 23))).toBe(false);
    expect(isBackupDue(weekly, at(28, 8))).toBe(true);
    expect(isBackupDue(weekly, at(30, 12) + 60 * 24 * 60 * 60 * 1000)).toBe(true);
  });
});

describe('runScheduledBackup', () => {
  const files = () => fs.readdirSync(folder).sort();

  function schedule() {
    createTemplate(db, 'Backend CV', createDefaultResume());
    setBackupFolder(db, folder);
    setBackupFrequency(db, 'daily');
  }

  it('writes a dated backup of every template, once a day', () => {
    schedule();
    runScheduledBackup(db, at(22, 9));
    runScheduledBackup(db, at(22, 18));
    expect(files()).toEqual([buildBackupFileName(new Date(at(22, 9)))]);

    const backup = JSON.parse(fs.readFileSync(path.join(folder, files()[0]), 'utf8'));
    expect(
      backup.templates.map((entry: { template: { name: string } }) => entry.template.name)
    ).toEqual(['Backend CV']);
    expect(readBackupStatus(db).last).toMatchObject({ at: at(22, 9), templates: 1, versions: 1 });

    runScheduledBackup(db, at(23, 9));
    expect(files()).toHaveLength(2);
  });

  it('never writes over a file already in the folder', () => {
    schedule();
    const name = buildBackupFileName(new Date(at(22, 9)));
    fs.writeFileSync(path.join(folder, name), 'mine');
    runScheduledBackup(db, at(22, 9));
    expect(fs.readFileSync(path.join(folder, name), 'utf8')).toBe('mine');
    expect(files()).toEqual([name.replace('.json', '-2.json'), name]);
  });

  it('keeps a failure for Settings, and tries again until one is written', () => {
    schedule();
    setBackupFolder(db, path.join(folder, 'gone'));
    runScheduledBackup(db, at(22, 9));
    expect(readBackupStatus(db).failure).toEqual({
      at: at(22, 9),
      message: 'The folder is gone. Choose another one.',
    });
    expect(readBackupStatus(db).last).toBeNull();

    fs.mkdirSync(path.join(folder, 'gone'));
    runScheduledBackup(db, at(22, 10));
    expect(readBackupStatus(db).failure).toBeNull();
    expect(readBackupStatus(db).last?.at).toBe(at(22, 10));
  });

  it('writes nothing while there are no templates, or while it is off', () => {
    setBackupFolder(db, folder);
    setBackupFrequency(db, 'daily');
    runScheduledBackup(db, at(22, 9));
    expect(files()).toEqual([]);

    createTemplate(db, 'Backend CV', createDefaultResume());
    setBackupFrequency(db, 'off');
    runScheduledBackup(db, at(22, 9));
    expect(files()).toEqual([]);
  });

  it('shows the folder under the home folder as ~', () => {
    setBackupFolder(db, path.join(os.homedir(), 'Backups'));
    setBackupFrequency(db, 'weekly');
    const expected =
      process.platform === 'win32' ? path.join(os.homedir(), 'Backups') : '~/Backups';
    expect(readBackupStatus(db)).toMatchObject({ frequency: 'weekly', folder: expected });
  });
});

describe('parseBackupFrequency', () => {
  it('takes the three frequencies and refuses anything else', () => {
    expect(parseBackupFrequency('weekly')).toBe('weekly');
    expect(() => parseBackupFrequency('hourly')).toThrow('Unknown backup frequency hourly');
    expect(() => parseBackupFrequency({ frequency: 'daily' })).toThrow();
  });
});

describe('buildBackupFileName', () => {
  it('uses a dashed date with the mosaic-backup prefix', () => {
    expect(buildBackupFileName(new Date(2026, 3, 23))).toBe('mosaic-backup-2026-04-23.json');
  });
});
