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
  // globalThis.toLocal: Map<string, Function>
  globalThis.toLocal = globalThis.toLocal || new Map();

  const remotePtr = crypto
    .createHash('sha256')
    .update(crypto.randomBytes(32))
    .digest('hex');

  globalThis.toLocal.set(remotePtr, func);

  function stub(/** @type {any[]} */ ...args) {
    const callback = args.pop();

    /** @type {any} */
    const __NODE_INFO__ = undefined;
    const __RPC_PTR__ = "__RPC_PTR__";
    
    const remote = {
      service: 'rpc',
      method: 'call',
      node: __NODE_INFO__,
    };

    globalThis.distribution.local.comm.send(
      [__RPC_PTR__, args],
      remote,
      callback
    );
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
