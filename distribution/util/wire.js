// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 * @typedef {import("../types.js").Hasher} Hasher
 */

const distribution = globalThis.distribution;

const log = require('../util/log.js');
const crypto = require('node:crypto');

/**
 * @param {Function} func
 */
function createRPC(func) {
  // add g to endpoint
  globalThis.toLocal = globalThis.toLocal || new Map();
  const remotePtr = crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
  const asyncFunc = toAsync(func);
  globalThis.toLocal.set(remotePtr, asyncFunc);

  // create function stub
  function stub(/** @type {any[]} */ ...args) {
    const callback = args.pop(); 
    if (typeof callback !== 'function') {
      throw new Error('RPC requires callback as last argument');
    }

    /** @type {any} */
    let node = distribution.node.config;
    
    const remote = {
      service: '__system__rpcService',
      method: 'call',
      node: node,
    };

    distribution.local.comm.send(
      [remotePtr, args],
      remote,
      callback 
    );
  }

  const originalSrc = stub.toString.bind(stub);
  stub.toString = () => {
    let src = originalSrc();
    src = src.replace(
      JSON.stringify(distribution.node.config),
      JSON.stringify(distribution.node.config)
    );
    return src;
  };

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
