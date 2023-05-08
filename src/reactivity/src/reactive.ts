import {
  mutableHandlers,
  shallowReactiveHandlers,
  readonlyHandlers,
  shallowReadonlyHandlers,
} from "./baseHandlers";

export const ITERATE_KEY = Symbol();

export function toRaw(observed) {
  const raw = observed && observed[ReactiveFlag.RAW];
  return raw ? toRaw(raw) : observed;
}

export const TriggerType = {
  SET: "SET",
  ADD: "ADD",
  DELETE: "DELETE",
};

export const enum ReactiveFlag {
  IS_REACTIVE = "__v_isReactive",
  IS_READONLY = "__v_isReadonly",
  IS_SHALLOW = "__v_isShallow",
  RAW = "_v_raw",
}

export const reactiveMap = new WeakMap();

export const shallowReactiveMap = new WeakMap();
export const shallowReadonlyMap = new WeakMap();

export const readonlyMap = new WeakMap();

export function reactive(target: object) {
  // 如果target是只读的代理对象，则返回它本身
  if (isReadonly(target)) {
    return target;
  }
  return createReactiveObject(target, false, mutableHandlers, reactiveMap);
}

export function readonly(target) {
  return createReactiveObject(target, true, readonlyHandlers, readonlyMap);
}

export function shallowReadonly(target) {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyMap
  );
}

export function shallowReactive(target: object) {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowReactiveMap
  );
}

// baseHanders是对目标对象的装饰器对象
// isReadonly只读
// proxyMap优化方案，缓存同一目标对象的代理防止多次对同一目标创建代理
function createReactiveObject(
  target: Object,
  isReadonly: boolean,
  baseHandlers,
  proxyMap
) {
  if (
    // target是readonly或shallowReadonly创建的代理对象
    target[ReactiveFlag.RAW] &&
    !(isReadonly && target[ReactiveFlag.IS_REACTIVE])
  ) {
    return target;
  }

  // 获取缓存数据，有缓存就直接返回
  // 当对象嵌套对象时，内部对象每次都会调用reactive方法返回新的代理对象，reactive([obj]).includes(obj),所以需要避免原始对象多次创建对象的问题
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }
  const proxy = new Proxy(target, baseHandlers);
  proxyMap.set(target, proxy);
  return proxy;
}

export function isReadonly(value: unknown): boolean {
  return value && value["__v_isReadonly"];
}
