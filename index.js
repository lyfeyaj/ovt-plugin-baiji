'use strict';

const assert = require('assert');

// ovt reference
let Ovt;

// Types mappings
const typeMappings = {
  array: ['any'],
  object: 'any',
  alternatives: 'any',
  func: 'any',
  buffer: 'any',
  regexp: 'any'
};

const supportTypes = ['object', 'array'];

function chooseType(schema) {
  let type = schema._type || 'any';

  if (isPredictableArray(schema)) {
    let child = schema._inner.inclusions[0] || schema._inner.requireds[0];
    return typeMappings[child._type] || type;
  } else {
    return typeMappings[type] || type;
  }
}

// Check whether array schema is predictable
function isPredictableArray(schema) {
  if (schema._type === 'array') {
    let inner = schema._inner;
    // Only allow to parse array schema with one object schema item
    let cond = inner.inclusions.length === 1 && inner.requireds.length === 0;
    cond = cond || (inner.inclusions.length === 0 && inner.requireds.length === 1);

    return cond;
  } else {
    return false;
  }
}

// ovt Schema extension, transfer nested children into baiji accepted params schema
// [
//   { name: 'gender', type: 'string' },
//   { name: 'profile', type: 'object' },
//   { name: 'hobbies', type: ['string'] }
// ]
function ovtPluginBaiji(ovt) {
  ovt.Schema.prototype.toObject = function() {
    if (!~supportTypes.indexOf(this._type)) return [];

    let params = [];
    let inner = this._inner;

    if (this._type === 'array') {
      if (!isPredictableArray(this)) return [];

      let child = inner.inclusions[0] || inner.requireds[0];

      // Only support inner object schema
      if (child._type !== 'object') return [];

      return child.toObject();
    } else {
      for (let name in inner.children) {
        let child = inner.children[name];
        let innerParams = child.toObject();

        // Add param item
        let param = {
          name: name,
          type: chooseType(child),
          description: child._description,
          required: !!child._methods.required,
          default: child._defaultValue,
          label: child._label,
          notes: child._notes.join(', '),
          tags: child._tags.join(', '),
          value: child._virtuals['value'],
        };

        // Add inner params
        if (innerParams.length) param.params = innerParams;

        params.push(param);
      }

      // Add schema reference
      params._schema = this;
    }

    return params;
  };

  // Add ovt reference
  Ovt = ovt;
}

ovtPluginBaiji.middleware = function(fn, options) {
  assert(Ovt, 'ovt-plugin-baiji must be required before middleware being called');
  assert(typeof fn === 'function', `${fn} is not a valid function`);

  options = options || {};

  return function ovtMiddleware(ctx, next) {
    let schema = (ctx._method.params || [])._schema;

    if (schema && schema.isOvt) {
      let result = Ovt.validate(ctx.args, schema, options);

      if (result.errors) {
        ctx.ovtErrors = result.errors.flatten() || [];
        ctx.ovtErrors.origin = result.errors;
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
