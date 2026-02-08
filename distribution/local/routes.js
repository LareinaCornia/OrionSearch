/**
 * @typedef {import("../types").Callback} Callback
 * @typedef {string} ServiceName
 */

const table = Object.create(null);

/**
 * @param {ServiceName | {service: ServiceName, gid?: string}} configuration
 * @param {Callback} callback
 * @returns {void}
 */
function get(configuration, callback) {
  try {
    const config = Array.isArray(configuration) ? configuration[0] : configuration;

    const name =
      typeof config === "string"
        ? config
        : config?.service;

    if (!name || !(name in table)) {
      return callback(new Error("Service does not exist"), null);
    }

    return callback(null, table[name]);

  } catch (err) {
    return callback(err, null);
  }
}

/**
 * @param {object} service
 * @param {string} configuration
 * @param {Callback} callback
 * @returns {void}
 */
function put(service, configuration, callback) {
  try {
    const s = Array.isArray(service) ? service[0] : service;
    const name = Array.isArray(configuration) ? configuration[0] : configuration;

    if (!name || typeof name !== "string") {
      return callback(new Error("Invalid service name"), null);
    }

    let finalService = s;

    const hasRPC = typeof s === 'object' && s !== null && Object.values(s).some(fn => typeof fn === 'function' && fn.__is_rpc_stub__);

    if (hasRPC) {
      finalService = Object.assign(Object.create(Object.getPrototypeOf(s)), s);

      for (const [method, fn] of Object.entries(s)) {
        if (typeof fn === "function" && fn.__is_rpc_stub__) {
          let src = fn.toString();
          
          src = src.replace(
            '__NODE_INFO__', 
            JSON.stringify(globalThis.distribution.node)
          );
          src = src.replace(
            '__RPC_PTR__',
            `'${fn.__rpc_ptr__}'`
          );
          finalService[method] = eval(`(${src})`);
        }
      }
    }

    table[name] = finalService;
    return callback(null, name);
  } catch (err) {
    return callback(err, null);
  }
}

/**
 * @param {string} configuration
 * @param {Callback} callback
 */
function rem(configuration, callback) {
  try {
    const name = Array.isArray(configuration) ? configuration[0] : configuration;

    if (!(name in table)) {
      return callback(new Error("Service does not exist"), null);
    }

    delete table[name];
    return callback(null, null);
  } catch (err) {
    return callback(err, null);
  }
}

const routesService = {
  get: get,
  put: put,
  rem: rem,
};

const rpcService = {
  call: (payload, callback) => {
    const [ptr, args] = payload;
    const fn = globalThis.toLocal.get(ptr);
    if (typeof fn === 'function') {
      fn(...args, callback);
    } else {
      callback(new Error("RPC procedure not found"));
    }
  }
};

table['routes'] = routesService;
table['rpc'] = rpcService;

module.exports = {get, put, rem};
