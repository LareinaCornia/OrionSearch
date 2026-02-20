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
    const serviceName = typeof config === "string" ? config : config?.service;
    const gid = typeof config === "string" ? null : config?.gid || 'local';

    // group service
    if (gid && gid !== "local") {
      const group = globalThis.distribution[gid];

      if (!group)
        return callback(new Error("Unknown GID"), null);

      const service = group[serviceName];

      if (!service)
        return callback(new Error("Service does not exist"), null);

      return callback(null, service);
    }

    // local service
    if (!serviceName || !(serviceName in table))
      return callback(new Error("Service does not exist"), null);
    return callback(null, table[serviceName]);
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

    const removed = table[name];
    delete table[name];
    return callback(null, removed); 
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
  call(ptr, args, callback) {
    const func = globalThis.toLocal.get(ptr);
    if (!func) {
      return callback(new Error('Unknown RPC ptr'), null);
    }
    func(...args, callback);
  }
};

module.exports = {get, put, rem};
