const test = require('node:test');
const assert = require('node:assert/strict');

test('CI 실패 확인용 임시 테스트', () => assert.fail('일부러 실패시킨 테스트'));
