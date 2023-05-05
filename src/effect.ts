import { extend } from "./shared/index";
import {
  newTracked,
  wasTracked,
  initDepMarkers,
  finalizeDepMarkers,
} from "./dep";
import { recordEffectScope } from "./effectScope";
import { ITERATE_KEY, TriggerType } from './reactive'

const targetMap = new WeakMap();

let shouldTrack = false;

const trackStack:boolean[] = []

let activeEffect;

let activeEffectStack: any[] = [];

// 副作用递归深度
let effectTrackDepth = 0;

// 优化标志位
export let trackOpBit = 1;

const maxMarkerBits = 30;

export class ReactiveEffect {
  // 激活标注位，表示当该副作用是否需要被收集
  active = true;

  deps = [];

  onStop?;

  // 推迟停止
  // 当activeEffect=this时并且scope.stop()在obj.msg之前调用时，因为响应式还没收集所以停止失败
  // 所以需要推迟stop,直到用户传入的回调执行完毕，保证响应式副作用被收集后再停止
  private deferStop?;

  constructor(public fn, public scheduler?, scope?) {
    recordEffectScope(this, scope);
  }

  run() {
    if (!this.active) {
      // 不被收集
      return this.fn();
    }
    try {
      // 通过activeEffect传递响应式副作用
      activeEffect = this;
      trackOpBit = 1 << ++effectTrackDepth;
      if (effectTrackDepth <= maxMarkerBits) {
        initDepMarkers(this);
      } else {
        cleanupEffect(this);
      }
      activeEffectStack.push(this);
      return this.fn();
    } finally {
      if (effectTrackDepth <= maxMarkerBits) {
        finalizeDepMarkers(this);
      }

      trackOpBit = 1 << --effectTrackDepth;
      // 回溯响应式副作用
      activeEffectStack.pop();
      activeEffect = activeEffectStack[activeEffectStack.length - 1];
      if (this.deferStop) {
        this.stop();
      }
    }
  }

  // 使该响应式副作用失效，并在依赖中删除
  stop() {
    if (activeEffect === this) {
      this.deferStop = true;
    } else if (this.active) {
      cleanupEffect(this);
      if (this.onStop) {
        this.onStop();
      }
      this.active = false;
    }
  }
}

function cleanupEffect(effect) {
  // 清除响应式副作用所在的依赖中的自身
  effect.deps.forEach((dep) => {
    dep.delete(effect);
  });
  // 清空effect.deps对dep的引用
  effect.deps.length = 0;
}

export function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false;
}

export function resetTracking() {
  const last = trackStack.pop();
  shouldTrack = last === undefined ? true : last;
}

export function track(target, key) {
  if (!activeEffect || !shouldTrack) return;

  let deps = targetMap.get(target);
  if (!deps) {
    targetMap.set(target, (deps = new Map()));
  }
  let dep = deps.get(key);
  if (!dep) {
    deps.set(key, (dep = new Set()));
  }
  trackEffect(dep);
}

function trackEffect(dep) {
  // 副作用是否应该收集
  let shouldTrack = false;
  if (effectTrackDepth <= maxMarkerBits) {
    // 没有打上新标记位的打上本轮标记
    if (!newTracked(dep)) {
      dep.n |= trackOpBit;
      shouldTrack = !wasTracked(dep);
    }
  } else {
    shouldTrack = dep.has(activeEffect);
  }
  if (shouldTrack) {
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
  }
}

export function trigger(target, key, type?, newVal?) {
  const deps = targetMap.get(target);
  if (!deps) return;
  const effects = deps.get(key);
  //  获得遍历的响应式
  const iterateEffects = deps.get(ITERATE_KEY)
  const effectsToRun: Set<any> = new Set();
  effects && effects.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn)
    }
  })
  if (type === TriggerType.ADD || type===TriggerType.DELETE) {
    iterateEffects && iterateEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }

  // 数组类型的代理对象在ADD时要将length属性相关的响应式副作用执行
  if (type === TriggerType.ADD && Array.isArray(target)) {
    const lengthEffects = deps.get('length');
    lengthEffects && lengthEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }
  // 当修改数组的length属性时，需要判断key是否大于等于newVal
  if (Array.isArray(target) && key === 'length') {
    deps.forEach((effects, key) => {
      if (key>=newVal) {
        effects.forEach(effectFn => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
          }
        })
      }
    })
  }

  effectsToRun.forEach((effect) => {
    if (effect.scheduler) {
      effect.scheduler(effect);
    } else {
      effect.run();
    }
  });
}

export interface ReactiveEffectRunner {
  (): any;
  effect: ReactiveEffect;
}

export function effect(fn, options?: any) {
  const _effect = new ReactiveEffect(fn);
  // 把options挂到响应式副作用上
  if (options) {
    extend(_effect, options);
    // 通过配置项手动传入scope来收集当前的响应式副作用
    if (options.scope) recordEffectScope(_effect, options.scope);
  }

  if (!options || !options.lazy) {
    _effect.run();
  }
  // 将响应式副作用的执行能力抛出
  const runner = _effect.run.bind(_effect) as ReactiveEffectRunner;
  runner.effect = _effect;
  return runner;
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
