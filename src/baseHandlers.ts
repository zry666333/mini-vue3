import { track, trigger } from "./effect";
import { reactive } from "./reactive";
import { isObject } from "./shared";

function createGetter(shallow = false) {
  return (target, key, receiver) => {
    track(target, key);
    const res = Reflect.get(target, key, receiver);
    if (shallow) {
      return res;
    }
    if (isObject(res)) {
      return reactive(res);
    }
    return res;
  };
}

function createSetter() {
  return (target, key, newValue, receiver) => {
    Reflect.set(target, key, newValue, receiver);
    trigger(target, key);
    return true;
  };
}

const get = createGetter();

const set = createSetter();

export const mutableHandlers = {
  get,
  set,
};

export const shallowReactiveHandlers = {
  get: createGetter(true),
  set,
};
