/**
 * Module dependencies.
 */

const debug = require('debug')('express-urlrewrite2');
const toRegexp = require('path-to-regexp');
const URL = require('url');
const slice = Array.prototype.slice;

/**
 * Expose `expose`.
 */

module.exports = rewrite;

/**
 * Rewrite `src` to `dst`.
 *
 * @param {String|RegExp} src source url for two parameters or destination url for one parameter
 * @param {String|Object|Function} [dst] destination url
 * @param {Object|Function} [options] options for rewriting
 * @param {String} [options.methods] http methods
 * @param {String} [options.method] http method
 * @param {Function} [options.filter] filter function
 * @return {Function}
 * @api public
 */

function rewrite(src, dst, options) {
  if (dst && typeof dst !== 'string') {
    options = dst;
    dst = src;
    src = null;
  } else if (!dst) {
    dst = src;
    src = null;
  }

  options = options || {};
  if (typeof options === 'function') {
    options = {filter: options}
  }

  let methods = options.methods || options.method || '*';
  if (!Array.isArray(methods)) {
    methods = [methods];
  }
  methods = methods.map(m => m.toUpperCase());

  const {filter} = options;

  let keys = [], re, map;

  if (src) {
    re = toRegexp(src, keys);
    map = toMap(keys);
    debug('rewrite %s -> %s    %s', src, dst, re);
  } else {
    debug('rewrite current route -> %s', src);
  }

  return function (req, res, next) {
    if (!methods.includes('*') && (!methods.includes(req.method.toUpperCase()))) {
      return next();
    }

    const orig = req.url;
    let m;
    if (src) {
      m = re.exec(req.path);
      if (!m) {
        return next();
      }
    }
    let qs = '';
    if (orig.indexOf('?') > 0) {
      qs = orig.substr(orig.indexOf('?') + 1);
    }

    function exec() {
      req.url = dst.replace(/\$(\d+)|(?::(\w+))/g, function (_, n, name) {
        if (name) {
          if (m) return m[map[name].index + 1];
          else return req.params[name];
        } else if (m) {
          return m[n];
        } else {
          return req.params[n];
        }
      });
      if (qs) {
        req.url += (req.url.indexOf('?') > 0 ? '&' : '?') + qs;
      }
      debug('rewrite %s -> %s', orig, req.url);
      if (req.url.indexOf('?') > 0) {
        req.query = URL.parse(req.url, true).query;
        debug('rewrite updated new query', req.query);
      }
      if (src) {
        return next('route');
      }
      next();
    }

    if (filter) {
      const result = filter(m, req, res);
      if (result && result.then) {
        return result.then(rewrite => rewrite === false ? next() : exec());
      }
    }
    exec();
  }
}

/**
 * Turn params array into a map for quick lookup.
 *
 * @param {Array} params
 * @return {Object}
 * @api private
 */

function toMap(params) {
  const map = {};

  params.forEach(function (param, i) {
    param.index = i;
    map[param.name] = param;
  });

  return map;
}

require('methods').map(method => {
  rewrite[method] = function () {
    const args = slice.call(arguments);
    const last = args.length - 1;
    const options = args[last];
    if (typeof options === 'string') {
      args.push({method});
    } else if (typeof options === 'function') {
      args[last] = {method, filter: options};
    } else if (options && typeof options === 'object') {
      options.method = method;
    }
    return rewrite.call(null, ...args);
  }
});
