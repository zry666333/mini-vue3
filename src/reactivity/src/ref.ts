import { reactive } from "./reactive";

// ref用于将基本数据类型转化为引用数据类型并具有响应
export function ref(value) {
  let _value = value;
  const wrapper = {
    get value() {
      return _value;
    },
    set value(newValue) {
      _value = newValue;
    },
  };
  Object.defineProperty(wrapper, '_v_isRef', {
    value: true
  })
  return reactive(wrapper);
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
