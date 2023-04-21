import { reactive } from "./reactive";

// ref用于将基本数据类型转化为引用数据类型并具有响应
export function ref(value) {
  let _value = value;
  const obj = {
    get value() {
      return _value;
    },
    set value(newValue) {
      _value = newValue;
    },
  };
  return reactive(obj);
}
