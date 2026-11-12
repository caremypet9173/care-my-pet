import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_NOTIFY_EMAILS,
  isValidNotifyEmail,
  parseNotifyEmailsInput,
  splitNotifyEmailDraft,
} from '../supabase/functions/pet-schedule/validation.mjs';

test('normalizes, deduplicates and enforces max 5 emails for schedule reminders', () => {
  assert.equal(MAX_NOTIFY_EMAILS, 5);
  assert.equal(isValidNotifyEmail('Partner@Example.COM '), true);
  assert.equal(isValidNotifyEmail('bad..email@example.com'), false);
  assert.equal(isValidNotifyEmail('no-domain'), false);

  const split = splitNotifyEmailDraft('Ania@wp.pl, tomek@gmail.com; ania@wp.pl');
  const parsed = parseNotifyEmailsInput(split);
  assert.deepEqual(parsed, {
    ok: true,
    emails: ['ania@wp.pl', 'tomek@gmail.com'],
  });

  const five = parseNotifyEmailsInput([
    'a@x.pl',
    'b@x.pl',
    'c@x.pl',
    'd@x.pl',
    'e@x.pl',
  ]);
  assert.equal(five.ok, true);

  const six = parseNotifyEmailsInput([
    'a@x.pl',
    'b@x.pl',
    'c@x.pl',
    'd@x.pl',
    'e@x.pl',
    'f@x.pl',
  ]);
  assert.deepEqual(six, { ok: false, error: 'too_many_emails' });

  const invalid = parseNotifyEmailsInput(['ok@x.pl', 'nie-email']);
  assert.deepEqual(invalid, {
    ok: false,
    error: 'invalid_email',
    invalidValue: 'nie-email',
  });
});
