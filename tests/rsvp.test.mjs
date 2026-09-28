import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRsvpDraft } from '../lib/rsvp-draft.ts';
const contact={whatsapp:'+94771234567',email:'rsvp.methmi.kavindu@example.lk'};
const details={name:'  Nimal & මාලා  ',email:'guest@example.com',attendance:'yes',guests:3,dietary:'Vegetarian & nut-free'};
test('RSVP drafts preserve guest details and safely encode both channels',()=>{
 const draft=buildRsvpDraft(details,contact);
 assert.equal(new URL(draft.whatsapp).pathname,'/94771234567');
 assert.equal(new URL(draft.whatsapp).searchParams.get('text'),draft.message);
 assert.equal(new URL(draft.email).searchParams.get('body'),draft.message);
 assert.match(draft.message,/Name: Nimal & මාලා/);
 assert.match(draft.message,/Guests \(including myself\): 3/);
 assert.match(draft.message,/Vegetarian & nut-free/);
});
test('Declined replies omit stale guest counts and dietary requirements',()=>{
 const draft=buildRsvpDraft({...details,attendance:'no'},contact);
 assert.match(draft.message,/Regretfully decline/);
 assert.doesNotMatch(draft.message,/Guests|Dietary|Vegetarian/);
});
