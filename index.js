/**
 * Module dependencies.
 */

const debug = require('debug')('express-urlrewrite2');
const toRegexp = require('path-to-regexp');
const URL = require('url');

/**
 * Expose `expose`.
 */

module.exports = rewrite;

/**
 * Rewrite `src` to `dst`.
 *
 * @param {String|RegExp} src source url for two parameters or destination url for one parameter
 * @param {String|Function} [dst] destination url
 * @param {Function} [filter] filter function
 * @return {Function}
 * @api public
 */

function rewrite(src, dst, filter) {
  if (typeof dst === 'function') {
    filter = dst;
    dst = src;
    src = null;
  } else if (!dst) {
    dst = src;
    src = null;
  }

  let keys = [], re, map;

  if (src) {
    re = toRegexp(src, keys);
    map = toMap(keys);
    debug('rewrite %s -> %s    %s', src, dst, re);
  } else {
    debug('rewrite current route -> %s', src);
  }

  return function (req, res, next) {
    const orig = req.url;
    let m;
    if (src) {
      m = re.exec(orig);
      if (!m) {
        return next();
      }
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
      const result = filter(m);
      if (result && result.then) {
        return result.then(exec);
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
