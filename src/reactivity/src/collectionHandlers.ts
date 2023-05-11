import { track, trigger } from "./effect"
import { ITERATE_KEY, reactive } from "./reactive";

const mutableInstrumentations = {
  add(key) {
    let res 
    const target = this['raw']
    const hadKey = target.has(key)
    // 值不存在的情况下才需要触发响应
    if (!hadKey) {
      res = target.add(key)
      trigger(target,key, 'ADD')
    }
    return res;
  },
  delete(key) {
    const target = this['raw']
    const hadKey = target.has(key)
    const res = target.delete(key)
    // 值不存在的情况下才需要触发响应
    if (hadKey) {
      trigger(target,key, 'DELETE')
    }
    return res;
  }, 
  get(key) {
    const target = this['raw']
    const had = target.has(key)
    track(target, key);
    if (had) {
      const res = target.get(key)
      return typeof res === 'object' ? reactive(res) : res;
    }
  },
  set(key, value) {
    const target = this['raw'];
    const had = target.has(key);
    const oldValue = target.get(key)
    const rawValue = value.raw || value
    target.set(key, rawValue);
    if(!had) {
      trigger(target, key, 'ADD')
    }else if(oldValue !== value || (oldValue === oldValue && value === value)){
      trigger(target, key, 'SET')
    }
  },
  forEach(callback, thisArg) {
    const wrap = (val) => typeof val === 'object' ? reactive(val) : val;
    const target = this['raw'];
    track(target, ITERATE_KEY);
    target.forEach((v, k) => {
      callback.call(thisArg, wrap(v), wrap(k), this)
    })
  }
}

export const mutableCollectionHandlers = {
  get: (target, key, receiver) => {
    if(key === 'raw') return target;
    if (key === 'size') {
      track(target, ITERATE_KEY)
      return Reflect.get(target, key, target)
    }
    // 将方法与原始数据绑定
    return mutableInstrumentations[key]
  }
}