// @ts-check

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
      type: type,          // ✅ 必须是小写
      value: object
    });
  }

  // function
  if (type === 'function') {
    return JSON.stringify({
      type: 'function',
      value: object.toString()
    });
  }

  // Date
  if (object instanceof Date) {
    return JSON.stringify({
      type: 'date',
      value: object.toISOString()
    });
  }

  // Error
  if (object instanceof Error) {
    return JSON.stringify({
      type: 'error',
      value: {
        name: object.name,
        message: object.message
      }
    });
  }

  // Array
  if (Array.isArray(object)) {
    return JSON.stringify({
      type: 'array',
      value: object.map(el => serialize(el))
    });
  }

  // Object (recursive)
  if (type === 'object') {
    const json = {};
    for (const key of Object.keys(object)) {
      json[key] = serialize(object[key]);
    }
    return JSON.stringify({
      type: 'object',
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
  // 🔴 官方 scenario 要求：malformed（包括非 string）→ SyntaxError
  if (typeof input !== 'string') {
    throw new SyntaxError('Malformed serialized string');
  }

  let json;
  try {
    json = JSON.parse(input);
  } catch {
    throw new SyntaxError('Malformed serialized string');
  }

  switch (json.type) {
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

    case 'function':
      // M1 允许不安全实现
      return new Function(`return ${json.value}`)();

    case 'date':
      return new Date(json.value);

    case 'error': {
      const err = new Error(json.value.message);
      err.name = json.value.name;
      return err;
    }

    case 'array':
      return json.value.map(v => deserialize(v));

    case 'object': {
      const obj = {};
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
