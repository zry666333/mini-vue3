import { effect, trigger, track } from "./effect";
import { isFunction } from "../../shared";

class ComputedRefImpl {
  // 缓存值
  private _value;
  dirty = true;

  effect;

  constructor(getter, setter?) {
    this.effect = effect(getter, {
      lazy: true,
      scheduler() {
        if (!this.dirty) {
          this.dirty = true;
          trigger(this, "value");
        }
      },
    });
  }

  get value() {
    track(this, "value");
    if (!this.dirty) {
      return this._value;
    }
    this._value = this.effect();
    this.dirty = false;
    return this._value;
  }
}

export function computed(getterOrOptions) {
  let getter;
  let setter;

  const onlyGetter = isFunction(getterOrOptions);

  if (onlyGetter) {
    getter = getterOrOptions;
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }

  const cRef = new ComputedRefImpl(getter, setter);

  return cRef;
}
