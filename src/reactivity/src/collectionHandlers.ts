import { track, trigger } from "./effect"
import { ITERATE_KEY, reactive } from "./reactive";

export const MAP_KEY_ITERATE_KEY = Symbol();

function keysIterationMethod() {
  const target = this.raw;
  const itr = target.keys()
  const wrap =(val) => typeof val === 'object' ? reactive(val) : val;
  track(target, MAP_KEY_ITERATE_KEY);
  return {
    next() {
      const {value,done} = itr();
      return {
        value: wrap(value),
        done
      }
    },
    [Symbol.iterator]() {
      return this;
    }
  }
  
}

function iterationMethod(){
  const target = this['raw'];
  const itr = target[Symbol.iterator]()
  const wrap = (val) => typeof val === 'object' && val !== null ? reactive(val) : val;
  // 调用track函数建立响应联系
  track(target, ITERATE_KEY)
  return {
    next() {
      const {value, done} = itr.next()
      return {
        // 如果迭代的数据是可被代理的，应该返回代理值
        value: value ? [wrap(value[0]), wrap(value[1])] :value,
        done
      }
    },
    // 实现可迭代协议
    [Symbol.iterator]() {
      return this;
    }
  };
}

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
  },
  [Symbol.iterator]:iterationMethod,
  entries: iterationMethod,
  value: valuesIterationMethod
}

function valuesIterationMethod() {
  const target = this['raw'];
  const itr = target.values();
  const wrap =(val) => typeof val === 'object' ? reactive(val) : val;
  track(target, ITERATE_KEY);

  return {
    next() {
      const {value, done} = itr.next();
      return {
        value: wrap(value),
        done
      }
    },
    [Symbol.iterator]() {
      return this;
    }
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