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

    if (name === 'rpcService' && table[name]) {
      Object.assign(table[name], s);
      return callback(null, name);
    }

    table[name] = s;
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

table['routes'] = routesService;

table['__system__rpcService'] = {
  call(ptr, args) {
    const cb = args[args.length - 1]; 
    const f = globalThis.toLocal.get(ptr);
    if (!f) 
      return cb(new Error("Unknown RPC ptr"));
    return f(...args);
  }
};

module.exports = {get, put, rem};
