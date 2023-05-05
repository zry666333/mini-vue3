import { track, trigger } from "./effect";
import {
  reactive,
  readonly,
  reactiveMap,
  shallowReactiveMap,
  readonlyMap,
  ReactiveFlag,
} from "./reactive";
import { isObject,extend } from "./shared";
import { ITERATE_KEY, TriggerType } from "./reactive";

const readonlyGet = createGetter(true);
const shallowReadonlyGet = createGetter(true, true)

function createGetter(isReadonly = false, shallow = false) {
  return (target, key, receiver) => {
    if (key === ReactiveFlag.IS_REACTIVE) {
      return !isReadonly;
    } else if(key === ReactiveFlag.IS_READONLY) {
      return isReadonly
    } else if(key === ReactiveFlag.IS_SHALLOW) {
      return shallow
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
    if (isObject(res) && res !== null) {
      return isReadonly ? readonly(res) : reactive(res);
    }
    return res;
  };
}

function createSetter() {
  return (target, key, newValue, receiver) => {
    const oldValue = target[key];
    Reflect.set(target, key, newValue, receiver);
    const type = Object.prototype.hasOwnProperty.call(target, key)
      ? TriggerType.SET
      : TriggerType.ADD;
    // 只有访问的是target的代理对象才会触发trigger,否则原型对象上的属性也会触发
    if (receiver[ReactiveFlag.RAW] === target) {
      // 值不全等的时候才会trigger，NaN === NaN为false
      if (
        (oldValue !== newValue && oldValue === oldValue) ||
        newValue === newValue
      ) {
        trigger(target, key, type);
      }
    }
    return true;
  };
}

const get = createGetter();
const shallowGet = createGetter(false, true)

const set = createSetter();

function has(target, key) {
  track(target, key);
  return Reflect.has(target, key);
}

function ownKeys(target) {
  track(target, ITERATE_KEY);
  return Reflect.ownKeys(target);
}

function deleteProperty(target, key) {
  // 是否存在key
  const hadKey = Object.prototype.hasOwnProperty.call(target, key);
  const res = Reflect.deleteProperty(target, key);
  if (hadKey && res) {
    trigger(target, key, TriggerType.DELETE);
  }
  return res;
}

export const mutableHandlers = {
  get,
  set,
  // 'foo' in obj
  has,
  // for in
  ownKeys,
  deleteProperty,
};

export const shallowReactiveHandlers = extend({},
  mutableHandlers, 
  {
    get: shallowGet,
    set,
  });

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
  deleteProperty(target, key){
    console.warn(
      `Set operation on key "${String(key)}" failed: target is readonly.`,
      target
    );
    return true;
  }
};

export const shallowReadonlyHandlers =extend({},readonlyHandlers,{
  get: shallowReadonlyGet
})
