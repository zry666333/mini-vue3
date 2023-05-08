import { ReactiveEffect } from "./effect";

let activeEffectScope: EffectScope | undefined;

export class EffectScope {
  // 失活标志位，用于剪枝不会多次触发this.stop()
  private _active = true;

  // 嵌套时收集子scope
  scopes: EffectScope[] | undefined;

  effects: any[] = [];

  cleanups: (() => void)[] = [];

  private index;

  // 嵌套上保留对上一级的引用
  // 在该scope关闭上，需要通过该项，从其父scope中移除对子scope的引用
  parent: EffectScope | undefined;

  constructor(public detached = false) {
    // 最外层scope的parent为undefined，嵌套scope的parent指向上一层的scope
    this.parent = activeEffectScope;
    if (!detached && activeEffectScope) {
      // 当嵌套effectScope时，会将当前的嵌套的effectscope实例收集在上一层effectscope的scopes中
      // 并且index永远指向该实例在父scope的scopes中的索引
      this.index =
        (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this
        ) - 1;
    }
  }

  get active() {
    return this._active;
  }

  // 调用用户传入的回调，并开始收集响应式副作用
  run<T>(fn: () => T): T {
    // 嵌套副作用时用来指向之前的副作用
    const currentEffectScope = activeEffectScope;
    try {
      // 把当前副作用传递到最外层，准备被收集
      activeEffectScope = this;
      // 执行用户传入的回调
      return fn();
    } finally {
      // 回溯
      activeEffectScope = currentEffectScope;
    }
  }

  stop(fromParent?: boolean) {
    if (this._active) {
      let i, l;
      for (i = 0, l = this.effects.length; i < l; i++) {
        // 调用scope收集到的响应式副作用的stop,使其失活
        this.effects[i].stop();
      }
      // 执行监听cleanup函数
      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]();
      }
      if (this.scopes) {
        // 遍历当前scope内的scopes使其都停止
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true);
        }
      }
      // 表示该scope是嵌套的scope
      // stop的调用并不是来自于父scope的stop调用，而是该嵌套scope主动掉用的
      if (!this.detached && this.parent && !fromParent) {
        const last = this.parent.scopes!.pop();
        if (last && last !== this) {
          // 这是一个O(1)的删除操作，类似在数组中删除某一项而不引起数组的重排
          this.parent.scopes![this.index] = last;
          last.index = this.index;
        }
      }
      this.parent = undefined;
      this._active = false;
    }
  }
}

// 实例化一个effectscope
// detached是一个分离标志，表示在嵌套scope中，detached为true的子scope也可以认为是一个独立于父scope的存在,但是parent的引用保留
export function effectScope(detached?: boolean) {
  return new EffectScope(detached);
}

// 让scope收集响应式副作用
export function recordEffectScope(
  effect: ReactiveEffect,
  scope: EffectScope | undefined = activeEffectScope
) {
  if (scope && scope.active) scope.effects.push(effect);
}

export function getCurrentScope() {
  return activeEffectScope;
}

export function onScopeDispose(fn: () => void) {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn);
  }
}
