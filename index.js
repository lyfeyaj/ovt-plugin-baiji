'use strict';

const assert = require('assert');

let OVT;

function typeMapper(type) {
  if (type === 'array') return ['any'];
  if (type === 'object') return 'any';
  return type;
}

// ovt Schema extension, transfer nested children into baiji accepted params
function ovtPluginBaiji(ovt) {
  ovt.Schema.prototype.toObject = function() {
    if (this._type !== 'object') return [];

    let params = [];

    for (let name in this._inner.children) {
      let child = this._inner.children[name];

      // Add param item
      params.push({
        name: name,
        type: typeMapper(child._type),
        description: child._description,
        label: child._label,
        notes: child._notes.join(', '),
        tags: child._tags.join(', '),
        http: child._virtuals['http'],
        inner: child.toObject()
      });
    }

    params._schema = this;

    return params;
  };

  // Add ovt reference
  OVT = ovt;
}

ovtPluginBaiji.middleware = function(fn, options) {
  assert(OVT, 'ovt-plugin-baiji must be required before middleware being called');
  assert(typeof fn === 'function', `${fn} is not a valid function`);

  options = options || {};

  return function(ctx, next) {
    let schema = (ctx._method.params || [])._schema;

    if (schema && schema.isOvt) {
      let result = OVT.validate(ctx.args, schema, options);

      if (result.errors) {
        ctx.ovtErrors = result.errors.flatten() || [];
        fn(ctx, next);
      } else {
        ctx.args = result.value;
        next();
      }
    } else {
      next();
    }
  };
};

module.exports = ovtPluginBaiji;