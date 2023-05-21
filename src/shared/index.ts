export const extend = Object.assign;

export const isFunction = (val) => typeof val === "function";

export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === 'object'

export const isString = (val: unknown): val is string => typeof val === 'string'

export const isIntegerKey = (key: unknown) =>
  isString(key) &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  '' + parseInt(key, 10) === key;

export const isArray = Array.isArray;

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
  val: object,
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key)