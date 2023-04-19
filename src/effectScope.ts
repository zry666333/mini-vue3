let activeEffectScope;

export class EffectScope {
  // 失活标志位，用于剪枝不会多次触发this.stop()
  private _active = true;

  // 收集装有副作用的集合，在更新副作用集合时需要
  scopes;

  effects: any[] = [];

  private index;

  parent;

  constructor(public detached = false) {
    if (activeEffectScope) {
      // activeEffectScope需要一个栈解构来存储上下文， index指向副作用位置
      // 当嵌套effectScope时，会将当前的嵌套的effectscope实例收集在上一层effectscope的scopes中
      this.index =
        (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this
        ) - 1;
    }
  }

  // 调用用户传入的回调，并开始收集响应式副作用
  run(fn) {
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

  stop() {
    if (this._active) {
      let i, l;
      for (i = 0, l = this.effects.length; i < l; i++) {
        // 调用scope收集到的响应式副作用的stop,使其失活
        this.effects[i].stop();
      }
      if (this.scopes) {
        // 遍历当前scope内的scopes使其都停止
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true);
        }
      }
      this._active = false;
    }
  }
}

// 实例化一个effectscope
export function effectScope(detached?: false) {
  return new EffectScope(detached);
}

// 让scope收集响应式副作用
export function recordEffectScope(effect, scope = activeEffectScope) {
  scope.effects.push(effect);
}

export function getCurrentScope() {
  return activeEffectScope;
}
