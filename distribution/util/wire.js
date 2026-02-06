// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 * @typedef {import("../types.js").Hasher} Hasher
 */
const log = require('../util/log.js');
const id = require('../util/id.js');

const toLocal = {};

/**
 * @param {Function} func
 */
function createRPC(func) {
  // Write some code...
  const remotePointer = id.getID(func.toString() + Math.random());
  toLocal[remotePointer] = func;

  const currentNode = typeof globalThis.local !== 'undefined' ? globalThis.node : 'UNKNOWN_NODE';

  const stub = (...args) => {
    const cb = args.pop();
    const remote = { 
      node: "__NODE_INFO__", 
      service: 'rpc', 
      method: "__RPC_ID__" 
    };
  
    globalThis.local.comm.send(args, remote, cb);
  };

  let stubStr = stub.toString()
    .replace("__NODE_INFO__", currentNode)
    .replace("__RPC_ID__", remotePointer);

  const finalStub = new Function(`return ${stubStr}`)();
  return finalStub;
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

function rpcHandler(args, remote, cb) {
  const pointer = remote.method;
  const func = toLocal[pointer];
  
  if (typeof func === 'function') {
    func(...args, cb);
  } else {
    cb(new Error(`RPC Method ${pointer} not found on this node.`));
  }
}

module.exports = {
  createRPC,
  toAsync,
  toLocal,
  rpcHandler,
};
