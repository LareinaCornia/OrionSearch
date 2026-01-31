// @ts-check

const fs = require('node:fs');
const os = require('node:os');
const repl = require('node:repl');

// native registry
const nativeRegistry = new Map();

// 5 hardcoded natives
nativeRegistry.set(console.log, { root: 'global', path: ['console', 'log'] });
nativeRegistry.set(fs.readFile,  { root: 'fs', path: ['readFile'] });
nativeRegistry.set(os.type,      { root: 'os', path: ['type'] });
nativeRegistry.set(setTimeout,   { root: 'global', path: ['setTimeout'] });
nativeRegistry.set(process.cwd,  { root: 'global', path: ['process', 'cwd'] });

function register(root, base, path = []) {
  if (typeof base === 'function' &&
      base.toString().includes('[native code]') &&
      !nativeRegistry.has(base)) {
    nativeRegistry.set(base, { root, path });
  }
}

// native global
for (const k of Object.keys(globalThis)) {
  try {
    register('global', globalThis[k], [k]);
  } catch {}
}

// native fs
for (const k of Object.keys(fs)) {
  try {
    register('fs', fs[k], [k]);
  } catch {}
}

/** @type {string[]} */
const builtinLibs = repl._builtinLibs || [];

for (const mod of builtinLibs) {
  if (mod.startsWith('_')) 
    continue;

  let exports;
  try {
    exports = require(mod);
  } catch {
    continue;
  }

  for (const key of Object.keys(exports)) {
    try {
      register(mod, exports[key], [key]);
    } catch {}
  }
}

// reverse native lookup
const nativeReverseRegistry = new WeakMap();
for (const [fn, desc] of nativeRegistry.entries()) {
  nativeReverseRegistry.set(fn, desc);
}

function resolveNative(desc) {
  let base =
    desc.root === 'global' ? globalThis :
    desc.root === 'fs'     ? require('fs') :
    desc.root === 'os'     ? require('os') :
    require(desc.root);

  for (const p of desc.path) {
    base = base[p];
  }
  return base;
}

// cycle helpers
let nextId = 1;
const seenSerialize = new WeakMap();
const seenDeserialize = new Map();

/**
 * @param {any} object
 * @returns {string}
 */
function serialize(object) {
  // null
  if (object === null) {
    return JSON.stringify({ type: 'null', value: null });
  }

  const type = typeof object;

  // basic types
  if (
    type === 'undefined' ||
    type === 'number' ||
    type === 'string' ||
    type === 'boolean'
  ) {
    let value = object;

    // special numbers
    if (Number.isNaN(object))
      value = 'NaN';
    else if (object === Infinity)
      value = 'Infinity';
    else if (object === -Infinity)
      value = '-Infinity';

    return JSON.stringify({
      type: type,
      value: value
    });
  }

  // date
  if (object instanceof Date) {
    return JSON.stringify({
      type: 'date',
      value: object.toISOString()
    });
  }

  // error
  if (object instanceof Error) {
    return JSON.stringify({
      type: 'error',
      value: {
        name: object.name,
        message: object.message
      }
    });
  }

  // native check
  if (
    (type === 'function' || type === 'object') &&
    nativeReverseRegistry.has(object)
  ) {
    return JSON.stringify({
      type: 'native',
      value: nativeReverseRegistry.get(object)
    });
  }

  // cycles detection
  if (seenSerialize.has(object)) {
    return JSON.stringify({ 
      type: 'reference', 
      id: seenSerialize.get(object)
    });
  }
  seenSerialize.set(object, nextId++);

  // function
  if (type === 'function') {
    return JSON.stringify({
      type: 'function',
      id: seenSerialize.get(object),
      value: object.toString()
    });
  }

  // array
  if (Array.isArray(object)) {
    return JSON.stringify({
      type: 'array',
      id: seenSerialize.get(object),
      value: object.map(el => serialize(el))
    });
  }

  // object
  if (type === 'object') {
    const json = {};
    for (const key of Object.keys(object)) {
      json[key] = serialize(object[key]);
    }
    return JSON.stringify({
      type: 'object',
      id: seenSerialize.get(object),
      value: json
    });
  }

  throw new Error(`Unsupported type: ${type}`);
}

/**
 * @param {any} input
 * @returns {any}
 */
function deserialize(input) {
  if (typeof input !== 'string') {
    throw new SyntaxError('Malformed serialized string');
  }

  let json;
  try {
    json = JSON.parse(input);
  } catch {
    throw new SyntaxError('Malformed serialized string');
  }

  if (json.type === 'reference') {
    return seenDeserialize.get(json.id);
  }

  switch (json.type) {
    // basic types
    case 'null':
      return null;
    case 'undefined':
      return undefined;
    case 'number':
      return Number(json.value);
    case 'string':
      return json.value;
    case 'boolean':
      return Boolean(json.value);

    case 'date':
      return new Date(json.value);

    case 'error': {
      const err = new Error(json.value.message);
      err.name = json.value.name;
      return err;
    }

    case 'native':
      return resolveNative(json.value);

    case 'function': {
      const fn = new Function(`return ${json.value}`)();
      seenDeserialize.set(json.id, fn);
      return fn;
    }

    case 'array': {
      const arr = [];
      seenDeserialize.set(json.id, arr); 
      for (const v of json.value) {
        arr.push(deserialize(v));
      }
      return arr;
    }

    case 'object': {
      const obj = {};
      seenDeserialize.set(json.id, obj);
      for (const key of Object.keys(json.value)) {
        obj[key] = deserialize(json.value[key]);
      }
      return obj;
    }

    default:
      throw new Error(`Unsupported type: ${json.type}`);
  }
}

module.exports = {
  serialize,
  deserialize,
};