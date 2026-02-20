// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 * @typedef {import("../types.js").Hasher} Hasher
 */

const distribution = globalThis.distribution;

const { serialize, deserialize } = require('../util/serialization.js');
const crypto = require('node:crypto');

/**
 * @param {Function} func
 */
function createRPC(func) {
  globalThis.toLocal = globalThis.toLocal || new Map();
  const remotePtr = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
  globalThis.toLocal.set(remotePtr, func);

  function stub(/** @type {any[]} */ ...args) {
    const callback = args.pop();
    if (typeof callback !== 'function') {
      throw new Error('RPC requires callback as last argument');
    }

    const remote = {
      service: '__system__rpcService',
      method: 'call',
      node: "__NODE_INFO__"
    };

    distribution.local.comm.send(
      ["__RPC_PTR__", args],
      remote,
      callback
    );
  }

  let src = stub.toString();

  src = src
    .replace('"__NODE_INFO__"', JSON.stringify(globalThis.distribution.node.config))
    .replace('"__RPC_PTR__"', JSON.stringify(remotePtr));

  const newStub = eval(`(${src})`);
  return newStub;
}

/**
 * The toAsync function transforms a synchronous function that returns a value into an asynchronous one,
 * which accepts a callback as its final argument and passes the value to the callback.
 * @param {Function} func
 */
function toAsync(func) {

  // It's the caller's responsibility to provide a callback
  const asyncFunc = (/** @type {any[]} */ ...args) => {
    const callback = args.pop();
    try {
      const result = func(...args);
      return callback(null, result);
    } catch (error) {
      return callback(error);
    }
  };

  /* Overwrite toString to return the original function's code.
   Otherwise, all functions passed through toAsync would have the same id. */
  asyncFunc.toString = () => func.toString();
  return asyncFunc;
}


module.exports = {
  createRPC,
  toAsync,
};
