import {test} from 'node:test';
import assert from 'node:assert/strict';
import {taskMatches} from '../server/propstack.mjs';
const row={id:'00000000-0000-4000-8000-000000000009',contact_id:123,owner_id:443334};
const task={body:`<p>INV-SUBMISSION:${row.id}</p><p>Form</p>`,note_type_id:734823,client_source_id:364441,broker_id:443334,clients:[{id:123}]};
test('actual expanded Propstack task response verifies the linked contact',()=>{
 assert.equal(taskMatches(task,null,row),true);
 assert.equal(taskMatches({...task,clients:[{id:124}]},null,row),false);
 assert.equal(taskMatches({...task,clients:[{id:123},{id:124}]},null,row),false);
 assert.equal(taskMatches({...task,clients:undefined},null,row),false);
 assert.equal(taskMatches({...task,broker_id:443333},null,row),false);
});
