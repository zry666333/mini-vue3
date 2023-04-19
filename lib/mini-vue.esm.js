const extend = Object.assign;

const initDepMarkers = ({ deps }) => {
    if (!deps.length)
        return;
    for (let i = 0; i < deps.length; i++) {
        deps[i].w |= trackOpBit;
    }
};
const newTracked = (dep) => {
    return (dep.n & trackOpBit) > 0;
};
const wasTracked = (dep) => {
    return (dep.w & trackOpBit) > 0;
};
const finalizeDepMarkers = (effect) => {
    const { deps } = effect;
    if (deps.length) {
        let ptr = 0;
        for (let i = 0; i < deps.length; i++) {
            const dep = deps[i];
            if (wasTracked(dep) && !newTracked(dep)) {
                dep.delete(effect);
            }
            else {
                deps[ptr++] = dep;
            }
            dep.w &= ~trackOpBit;
            dep.n &= ~trackOpBit;
        }
        deps.length = ptr;
    }
};

let activeEffectScope;
class EffectScope {
    constructor(detached = false) {
        this.detached = detached;
        this.effects = [];
        if (activeEffectScope) {
            this.index =
                (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(this) - 1;
        }
    }
    run(fn) {
        const currentEffectScope = activeEffectScope;
        try {
            activeEffectScope = this;
            return fn();
        }
        finally {
            activeEffectScope = currentEffectScope;
        }
    }
    stop() {
        let i, l;
        for (i = 0, l = this.effects.length; i < l; i++) {
            this.effects[i].stop();
        }
        if (this.scopes) {
            for (i = 0, l = this.scopes.length; i < l; i++) {
                this.scopes[i].stop(true);
            }
        }
    }
}
function effectScope(detached) {
    return new EffectScope(detached);
}
function recordEffectScope(effect, scope = activeEffectScope) {
    scope.effects.push(effect);
}

const targetMap = new WeakMap();
let activeEffect;
let activeEffectStack = [];
Promise.resolve();
let effectTrackDepth = 0;
let trackOpBit = 1;
const maxMarkerBits = 30;
class ReactiveEffect {
    constructor(fn, scheduler, scope) {
        this.fn = fn;
        this.active = true;
        this.deps = [];
        recordEffectScope(this, scope);
    }
    run() {
        if (!this.active) {
            return this.fn();
        }
        try {
            activeEffect = this;
            trackOpBit = 1 << ++effectTrackDepth;
            if (effectTrackDepth <= maxMarkerBits) {
                initDepMarkers(this);
            }
            else {
                cleanupEffect(this);
            }
            activeEffectStack.push(this);
            return this.fn();
        }
        finally {
            if (effectTrackDepth <= maxMarkerBits) {
                finalizeDepMarkers(this);
            }
            trackOpBit = 1 << --effectTrackDepth;
            activeEffectStack.pop();
            activeEffect = activeEffectStack[activeEffectStack.length - 1];
            if (this.deferStop) {
                this.stop();
            }
        }
    }
    stop() {
        if (activeEffect === this) {
            this.deferStop = true;
        }
        else if (this.active) {
            cleanupEffect(this);
            if (this.onStop) {
                this.onStop();
            }
            this.active = false;
        }
    }
}
function cleanupEffect(effect) {
    effect.deps.forEach((dep) => {
        dep.delete(effect);
    });
    effect.deps.length = 0;
}
function track(target, key) {
    if (!activeEffect)
        return;
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
    let shouldTrack = false;
    if (effectTrackDepth <= maxMarkerBits) {
        if (!newTracked(dep)) {
            dep.n |= trackOpBit;
            shouldTrack = !wasTracked(dep);
        }
    }
    else {
        shouldTrack = dep.has(activeEffect);
    }
    if (shouldTrack) {
        dep.add(activeEffect);
        activeEffect.deps.push(dep);
    }
}
function trigger(target, key) {
    const deps = targetMap.get(target);
    if (!deps)
        return;
    const effects = deps.get(key);
    const effectsToRun = new Set(effects);
    effectsToRun.forEach((effect) => {
        if (effect === activeEffect)
            return;
        if (effect.scheduler) {
            effect.scheduler(effect);
        }
        else {
            effect.run();
        }
    });
}
function effect(fn, options) {
    const _effect = new ReactiveEffect(fn);
    if (options) {
        extend(_effect, options);
        if (options.scope)
            recordEffectScope(_effect, options.scope);
    }
    if (!_effect.lazy) {
        _effect.run();
    }
    const runner = _effect.run.bind(_effect);
    runner.effect = _effect;
    return runner;
}
function computed(getter) {
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
    if (typeof value !== "object" || value === null || seen.has(value))
        return;
    seen.add(value);
    for (let key in value) {
        traverse(value[key], seen);
    }
    return value;
}
function watch(source, callback, options) {
    let newValue;
    let oldValue;
    let getter;
    let cleanup;
    let onValidate = (fn) => {
        cleanup = fn;
    };
    if (typeof source === "function") {
        getter = source;
    }
    else {
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
    }
    else {
        oldValue = effectFn();
    }
}

function reactive(obj) {
    return new Proxy(obj, {
        get(target, key) {
            track(target, key);
            return target[key];
        },
        set(target, key, newValue) {
            target[key] = newValue;
            trigger(target, key);
            return true;
        },
    });
}

export { computed, effect, effectScope, reactive, watch };
//# sourceMappingURL=mini-vue.esm.js.map
