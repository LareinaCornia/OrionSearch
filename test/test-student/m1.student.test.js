/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

test('(1 pts) student test', () => {
  // Fill out this test case...
  // primitive values
  const values = [42, 'hello', true, null, undefined];
  
  for (const v of values) {
    const s = distribution.util.serialize(v);
    const d = distribution.util.deserialize(s);
    expect(d).toBe(v);
  }
});


test('(1 pts) student test', () => {
  // Fill out this test case...
  // simple object
  const obj = {
    a: 1,
    b: 'text',
    c: false,
  };

  const s = distribution.util.serialize(obj);
  const d = distribution.util.deserialize(s);

  expect(d).toEqual(obj);
});


test('(1 pts) student test', () => {
  // Fill out this test case...
  // array
  const arr = [1, 'two', null, true, { x: 10 }];

  const s = distribution.util.serialize(arr);
  const d = distribution.util.deserialize(s);

  expect(d).toEqual(arr);
});

test('(1 pts) student test', () => {
  // Fill out this test case...
  // function 
  function foo(x) {
    return x + 1;
  }

  const s = distribution.util.serialize(foo);
  const d = distribution.util.deserialize(s);

  expect(typeof d).toBe('function');
});

test('(1 pts) student test', () => {
  // Fill out this test case...
  // complex object
  const obj = {};
  for (let i = 0; i < 1000; i++) {
    obj[`key_${i}`] = {
      index: i,
      value: `value_${i}`,
    };
  }

  const s = distribution.util.serialize(obj);
  const d = distribution.util.deserialize(s);

  expect(d).toEqual(obj);
});
