import { extend } from './shared/index'
import { reactive } from './reactive';

const targetMap = new WeakMap();

let activeEffect;

let activeEffectStack:any[] = [];

const jobQueue:Set<any> = new Set();

let isFlushing = false;

const p = Promise.resolve();



export class ReactiveEffect {
  deps = []
  constructor(public fn, scheduler?) {}

  run(){
    // 通过activeEffect传递响应式副作用
    activeEffect = this
    activeEffectStack.push(this)
    cleanupEffect(this)
    const result = this.fn()
    // 回溯响应式副作用
    activeEffectStack.pop();
    activeEffect =activeEffectStack[activeEffectStack.length - 1];
    return result
  }
}

function cleanupEffect(effect) {
  // 清除响应式副作用所在的依赖中的自身
  effect.deps.forEach(dep => {
    dep.delete(effect)
  });
  effect.deps.length = 0;
}

export function track(target, key) {
  if (!activeEffect) return;
  let deps = targetMap.get(target);
  if (!deps) {
    targetMap.set(target, (deps = new Map()));
  }
  let dep = deps.get(key);
  if (!dep) {
    deps.set(key, (dep = new Set()));
  }
  dep.add(activeEffect);
  activeEffect.deps.push(dep);
}

export function trigger(target, key) {
  const deps = targetMap.get(target);
  if (!deps) return;
  const effects = deps.get(key);
  const effectsToRun:Set<any> = new Set(effects);
  effectsToRun.forEach((effect) => {
    if (effect === activeEffect) return;
    if (effect.options) {
      const { scheduler } = effect.options;
      scheduler && scheduler(effect);
    } else {
      effect.run();
    }
  });
}

function cleanup(effect) {
  effect.deps.forEach((dep) => {
    dep.delete(effect);
  });
  effect.deps = [];
}

// export function effect(fn, options) {
//   function effectFn() {
//     activeEffect = effectFn;
//     activeEffectStack.push(effectFn);
//     cleanup(activeEffect);
//     const res = fn();
//     activeEffectStack.pop();
//     activeEffect = activeEffectStack[activeEffectStack.length - 1];
//     return res;
//   }
//   if (!effectFn.deps) effectFn.deps = [];
//   options && (effectFn.options = options);
//   if (options && options.lazy) {
//     return effectFn;
//   }
//   effectFn();
// }

export function effect(fn, options:any = {}) {
  const _effect = new ReactiveEffect(fn);
  // 把options挂到响应式副作用上
  extend(_effect, options)
  if (!options.lazy) {
    _effect.run()
  }
  // 将响应式副作用的执行能力抛出
  const runner = _effect.run.bind(_effect)
  runner.effect = _effect
  return runner
}

function flushJob() {
  if (isFlushing) return;
  p.then(() => {
    jobQueue.forEach((effect) => effect());
    isFlushing = false;
  });
}

export function computed(getter) {
  let value;
  let dirty = true;
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      if (!dirty) {
        dirty = true;
        trigger(obj, "value");
      }
    },
  });

  const obj = {
    get value() {
      track(obj, "value");
      if (!dirty) {
        return value;
      }
      value = effectFn();
      dirty = false;
      return value;
    },
  };
  return obj;
}

function traverse(value, seen = new Set()) {
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  seen.add(value);
  for (let key in value) {
    traverse(value[key], seen);
  }
  return value;
}

export function watch(source, callback, options) {
  let newValue;
  let oldValue;
  let getter;
  let cleanup;
  let onValidate = (fn) => {
    cleanup = fn;
  };

  if (typeof source === "function") {
    getter = source;
  } else {
    getter = () => traverse(source);
  }
  function job() {
    newValue = effectFn();
    cleanup && cleanup();
    callback(newValue, oldValue, onValidate);
    oldValue = newValue;
  }

  const effectFn = effect(getter, {
    lazy: true,
    scheduler(fn) {
      job();
    },
  });

  if (options && options.immediate) {
    job();
  } else {
    oldValue = effectFn();
  }
}

