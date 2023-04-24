import { track, trigger } from "./effect";

export const ITERATE_KEY = Symbol();

export const TriggerType = {
  SET: "SET",
  ADD: "ADD",
  DELETE: "DELETE",
};

export function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      // 代理对象可以通过raw访问原始数据
      if (key === "raw") return target;
      track(target, key);
      return Reflect.get(target, key, receiver);
    },
    set(target, key, newValue, receiver) {
      const oldValue = target[key];
      Reflect.set(target, key, newValue, receiver);
      const type = Object.prototype.hasOwnProperty.call(target, key)
        ? TriggerType.SET
        : TriggerType.ADD;
      // 只有访问的是target的代理对象才会触发trigger,否则原型对象上的属性也会触发
      if (receiver.raw === target) {
        // 值不全等的时候才会trigger，NaN === NaN为false
        if (
          (oldValue !== newValue && oldValue === oldValue) ||
          newValue === newValue
        ) {
          trigger(target, key, type);
        }
      }
      return true;
    },
    // 'foo' in obj
    has(target, key) {
      trigger(target, key);
      return Reflect.has(target, key);
    },
    // for in
    ownKeys(target) {
      trigger(target, ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
    deleteProperty(target, key) {
      // 是否存在key
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const res = Reflect.deleteProperty(target, key);
      if (hadKey && res) {
        trigger(target, key, TriggerType.DELETE);
      }
      return res;
    },
  });
}
