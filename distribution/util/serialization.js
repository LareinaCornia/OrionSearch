// @ts-check

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
    return JSON.stringify({
      type: type,
      value: object
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

  // cycles detection
  if (seenSerialize.has(object)) {
      return JSON.stringify({ 
        type: 'reference', 
        id: seenSerialize.get(object) });
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
