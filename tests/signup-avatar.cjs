const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const source = fs.readFileSync('src/main.js', 'utf8');
const start = source.indexOf('async function applyPendingSignupAvatar()');
const end = source.indexOf('\n}\n', start);
assert.ok(start >= 0 && end > start, 'pending avatar handler exists');

const email = 'novo@example.com';
const avatar = new Blob(['foto'], { type: 'image/jpeg' });
const key = `signup_avatar:${email}`;
const calls = [];
const context = {
  state: { user: { id: 'user-1', email, user_metadata: { name: 'Novo' } }, profile: { name: 'Novo', avatar_path: null } },
  offlineStore: {
    async getMeta(requested) { calls.push(['get', requested]); return avatar; },
    async saveProfile(profile) { calls.push(['cache', profile.avatar_path]); },
    async deleteMeta(requested) { calls.push(['delete', requested]); }
  },
  async trySupabase() { return client; },
  syncProfileUI() { calls.push(['render']); },
  console,
  Date
};
const client = {
  auth: { async getUser() { calls.push(['verify']); return { data: { user: { id: 'user-1' } } }; } },
  storage: {
    from(bucket) {
      assert.equal(bucket, 'profile-photos');
      return {
        async upload(path, photo, options) {
          assert.equal(photo, avatar);
          assert.equal(options.contentType, 'image/jpeg');
          calls.push(['upload', path]);
          return { error: null };
        },
        async createSignedUrl(path) { calls.push(['signed', path]); return { data: { signedUrl: 'signed-photo' } }; }
      };
    }
  },
  from(table) {
    assert.equal(table, 'passenger_profiles');
    return {
      upsert(profile) {
        calls.push(['upsert', profile]);
        return { select() { return { async single() { return { data: profile, error: null }; } }; } };
      }
    };
  }
};

vm.createContext(context);
vm.runInContext(`let pendingSignupAvatarTask = null;\n${source.slice(start, end + 2)}`, context);

(async () => {
  await context.applyPendingSignupAvatar();
  assert.ok(calls.some(([action]) => action === 'upload'));
  assert.deepEqual(calls.filter(([action]) => action === 'delete')[0], ['delete', key]);
  assert.equal(context.state.profile.avatar_url, 'signed-photo');

  calls.length = 0;
  context.state.profile.avatar_path = null;
  client.auth.getUser = async () => ({ data: { user: { id: 'another-user' } } });
  await context.applyPendingSignupAvatar();
  assert.equal(calls.some(([action]) => action === 'upload'), false, 'never uploads under another session');
  assert.equal(calls.some(([action]) => action === 'delete'), false, 'keeps photo for the rightful session');

  console.log('PASS: signup photo waits for the matching confirmed account and updates its profile');
})().catch(error => { console.error(error); process.exitCode = 1; });
