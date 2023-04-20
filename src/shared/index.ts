export const extend = Object.assign;

export const isFunction = (val) => typeof val === "function";

export const isObject = (val) => {
  return val && typeof val === "object";
};
