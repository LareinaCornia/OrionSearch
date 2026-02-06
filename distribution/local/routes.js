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
    const name =
      typeof configuration === "string"
        ? configuration
        : configuration?.service;

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
    if (!configuration || typeof configuration !== "string") {
      return callback(new Error("Invalid service name"), null);
    }

    if (typeof service !== "object") {
      return callback(new Error("Invalid service object"), null);
    }

    table[configuration] = service;

    return callback(null, configuration);

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
    if (!(configuration in table)) {
      return callback(new Error("Service does not exist"), null);
    }

    delete table[configuration];

    return callback(null, null);

  } catch (err) {
    return callback(err, null);
  }
}

module.exports = {get, put, rem};
