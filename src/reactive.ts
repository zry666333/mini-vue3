import { mutableHandlers, shallowReactiveHandlers } from "./baseHandlers";

const proxyMap = new WeakMap();

const shallowReactiveMap = new WeakMap();

export function reactive(target: object) {
  // 如果target是只读的代理对象，则返回它本身
  if (isReadonly(target)) {
    return target;
  }
  return createReactiveObject(target, false, mutableHandlers, proxyMap);
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
  // 获取缓存数据，有缓存就直接返回
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
