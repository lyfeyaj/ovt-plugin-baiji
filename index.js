'use strict';

const assert = require('assert');
const intersection = require('lodash.intersection');

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

// Enum methods
const enumMethods = [
  'valid',
  'only',
  'whitelist',
  'oneOf'
];

const supportTypes = ['object', 'array'];

// Choose type for schema
function chooseType(schema) {
  let type = schema._type || 'any';

  if (isPredictableArraySchema(schema)) {
    let child = schema._inner.inclusions[0] || schema._inner.requireds[0];

    if (isPredictableArraySchema(child)) {
      return ['array'];
    } else {
      if (child._type === 'array') {
        return typeMappings[child._type];
      } else {
        return [typeMappings[child._type] || child._type];
      }
    }
  } else {
    return typeMappings[type] || type;
  }
}

// Check whether array schema is predictable:
//    => with only one schema in `inclusions` or `requireds`
function isPredictableArraySchema(schema) {
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

// Build param from schema
function buildParam(schema) {
  if (!schema) return {};

  // Extract enum values
  let enumValues;
  enumMethods.forEach(function(name) {
    let method = schema._methods[name];
    if (method) {
      let args = method.args;
      if (args.length === 1 && Array.isArray(args[0])) {
        args = args[0];
      }

      if (!enumValues) {
        enumValues = Array.prototype.slice.call(args);
      } else {
        enumValues = intersection(enumValues, args);
      }
    }
  });

  let param = {
    type: chooseType(schema),
    description: schema._description,
    required: !!schema._methods.required,
    default: schema._defaultValue,
    label: schema._label,
    notes: schema._notes.join(', '),
    tags: schema._tags.join(', '),
    value: schema._virtuals['value'],
  };

  if (enumValues && enumValues.length) param.enum = enumValues;

  return param;
}

// ovt Schema extension, transfer nested children into baiji accepted params schema
// [
//   { name: 'gender', type: 'string' },
//   { name: 'profile', type: 'object', params: [{ name: 'age', type: 'number' }] },
//   { name: 'hobbies', type: ['string'] }
//   { name: 'hobbies', type: ['array'], params: [{ type: 'string' }] }
// ]
function ovtPluginBaiji(ovt) {
  ovt.Schema.prototype.toObject = function() {
    if (!~supportTypes.indexOf(this._type)) return [];

    let params = [];
    let inner = this._inner;

    if (this._type === 'array') {
      if (!isPredictableArraySchema(this)) return [];

      let child = inner.inclusions[0] || inner.requireds[0];

      let innerParams = child.toObject();

      // Handle inner object type
      if (child._type === 'object') return innerParams;

      // Handle inner array type
      if (child._type === 'array') {
        let param = buildParam(child);

        if (innerParams.length) param.params = innerParams;

        return [param];
      }

      return [];
    } else {
      for (let name in inner.children) {
        let child = inner.children[name];
        let innerParams = child.toObject();

        // Add param item
        let param = buildParam(child);

        // Add name property
        param.name = name;

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
