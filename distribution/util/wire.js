// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 * @typedef {import("../types.js").Hasher} Hasher
 */
const log = require('../util/log.js');
const crypto = require('node:crypto');

/**
 * @param {Function} func
 */
function createRPC(func) {
  // Write some code...
  if (typeof func !== 'function') {
    throw new TypeError(`createRPC expects a function, got ${typeof func}`);
  }

  // globalThis.toLocal: Map<string, Function>  (remote pointer -> local function)
  const remotePtr = crypto
    .createHash('sha256')
    .update(crypto.randomBytes(32))
    .digest('hex');

  globalThis.toLocal.set(remotePtr, func);

  function stub(/** @type {any[]} */ ...args) {
    /** @type {Callback} */
    const callback = args.pop();

    if (typeof callback !== 'function') {
      throw new Error('RPC stub must be called with a callback as the last argument');
    }

    const local = globalThis.distribution?.local;
    const comm = local?.comm;

    if (!comm || typeof comm.send !== 'function') {
      return callback(new Error('RPC stub cannot find global.distribution.local.comm.send'));
    }

    /** @type {{node: any, service: string, method: string}} */
    const remote = {
      node: "__NODE_INFO__",
      service: 'rpc',
      method: 'call',
    };

    const message = [ "__RPC_PTR__", args ];

    comm.send(message, remote, callback);
  }

  stub.__rpc_ptr__ = remotePtr;
  stub.__is_rpc_stub__ = true;

  return stub;
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
