import { track, trigger } from "./effect";
import {
  reactive,
  readonly,
  reactiveMap,
  shallowReactiveMap,
  readonlyMap,
  ReactiveFlag,
} from "./reactive";
import { isObject } from "./shared";

const readonlyGet = createGetter(true);

function createGetter(isReadonly = false, shallow = false) {
  return (target, key, receiver) => {
    if (key === ReactiveFlag.IS_REACTIVE) {
      return !isReadonly;
    }

    // 当访问_v_raw属性时，返回原始数据
    const isExistInReactiveMap = () => {
      return key === ReactiveFlag.RAW && receiver === reactiveMap.get(target);
    };
    // 当访问_v_raw属性时，返回原始数据
    const isExistInShallowReactiveMap = () => {
      return (
        key === ReactiveFlag.RAW && receiver === shallowReactiveMap.get(target)
      );
    };
    // 当访问_v_raw属性时，返回原始数据
    const isExistInReadonlyMap = () => {
      return key === ReactiveFlag.RAW && receiver === readonlyMap.get(target);
    };

    if (
      isExistInReactiveMap() ||
      isExistInShallowReactiveMap() ||
      isExistInReadonlyMap()
    )
      return target;

    // 只读的代理对象不会触发set，不会触发trigger，所以不用收集依赖了
    if (!isReadonly) {
      track(target, key);
    }
    const res = Reflect.get(target, key, receiver);
    if (shallow) {
      return res;
    }
    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res);
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
  get: createGetter(false, true),
  set,
};

export const readonlyHandlers = {
  get: readonlyGet,
  set(target, key) {
    // readonly 的响应式对象不可以修改值
    console.warn(
      `Set operation on key "${String(key)}" failed: target is readonly.`,
      target
    );
    return true;
  },
};
