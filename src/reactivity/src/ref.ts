import { isObject } from "src/shared";
import { reactive, toRaw } from "./reactive";
import {shouldTrack, activeEffect, trackEffects,triggerEffects, trigger} from './effect'
import { createDep} from './dep'
import { isShallow,isReadonly } from "./reactive";
import { hasChanged } from "src/shared/general";

declare const RefSymbol: unique symbol;

export interface Ref<T=any> {
  value: T
  [RefSymbol]: true;
}

// ref用于将基本数据类型转化为引用数据类型并具有响应
export function ref(value?:unknown) {
  return createRef(value, false)
}

export function isRef<T>(r: Ref<T> | unknown):r is Ref<T>;
export function isRef(r:any): r is Ref {
  return !!(r && r._v_isRef === true)
}

export type UnwrapRef<T> = T extends Ref<infer V> ? UnwrapRefSimple<V> : UnwrapRefSimple<T>

export type UnwrapRefSimple<T> = T extends Function | Ref ?
  T : {
    [P in keyof T]: P extends symbol ? T[P] : UnwrapRef<T[P]>
  }

export const toReactive =<T extends unknown>(value: T):T => {
  return isObject(value) ? reactive(value as T & Record<any,any>) : value
}

export function trackRefValue(ref) {
  if(shouldTrack && activeEffect) {
    ref = toRaw(ref)
    trackEffects(ref.dep || (ref.dep = createDep()))
  }
}

class RefImpl {
  private _rawValue
  private _value

  public dep?
  public readonly _v_isRef = true;

  constructor(value,public readonly __v_isShallow: boolean) {
    this._rawValue = __v_isShallow ? value : toRaw(value)
    this._value = __v_isShallow ? value : toReactive(value)
  }

  get value() {
    trackRefValue(this)
    return this._value
  }

  set value(newVal){
    const useDirectValue =
    this.__v_isShallow || isShallow(newVal) || isReadonly(newVal)
  newVal = useDirectValue ? newVal : toRaw(newVal)
  if(hasChanged(newVal, this._rawValue)) {
    this._rawValue = newVal;
    this._value = useDirectValue ? newVal : toReactive(newVal);
    triggerRefValue(this, newVal)
  }
  }
}

export function triggerRefValue(ref, newVal) {
  ref=toRaw(ref);
  const dep = ref.dep;
  if (dep) {
    triggerEffects(dep);
  }
}

function createRef(rawValue:unknown, shallow: boolean){
  if (isRef(rawValue)) {
    return rawValue
  }
  return new RefImpl(rawValue, shallow)

  // let _value = value;
  // const wrapper = {
  //   get value() {
  //     return _value;
  //   },
  //   set value(newValue) {
  //     _value = newValue;
  //   },
  // };
  // Object.defineProperty(wrapper, '_v_isRef', {
  //   value: true
  // })
  // return reactive(wrapper);
}

export function toRef(obj, key) {
  const wrapper ={
    get value() {
      return obj[key]
    },
    set value(val) {
      obj[key] = val
    }
  }
  return wrapper
}

export function toRefs(obj) {
  const ret = {}
  for(const key in obj) {
    ret[key] = toRef(obj, key)
  }
  return ret;
}

function proxyRefs(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver)
      return value._v_isRef ? value.value : value;
    },
    set(target, key, newValue, receiver) {
      const value = target[key];
      if(value._v_isRef) {
        value.value = newValue;
        return true;
      }
      return Reflect.set(target, key, newValue, receiver)
    }
  })
}
