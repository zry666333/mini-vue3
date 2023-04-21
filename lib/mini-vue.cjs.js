'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const extend = Object.assign;
const isFunction = (val) => typeof val === "function";
const isObject = (val) => {
    return val && typeof val === "object";
};

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
        this._active = true;
        this.effects = [];
        this.cleanups = [];
        this.parent = activeEffectScope;
        if (!detached && activeEffectScope) {
            this.index =
                (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(this) - 1;
        }
    }
    get active() {
        return this._active;
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
    stop(fromParent) {
        if (this._active) {
            let i, l;
            for (i = 0, l = this.effects.length; i < l; i++) {
                this.effects[i].stop();
            }
            for (i = 0, l = this.cleanups.length; i < l; i++) {
                this.cleanups[i]();
            }
            if (this.scopes) {
                for (i = 0, l = this.scopes.length; i < l; i++) {
                    this.scopes[i].stop(true);
                }
            }
            if (!this.detached && this.parent && !fromParent) {
                const last = this.parent.scopes.pop();
                if (last && last !== this) {
                    this.parent.scopes[this.index] = last;
                    last.index = this.index;
                }
            }
            this.parent = undefined;
            this._active = false;
        }
    }
}
function effectScope(detached) {
    return new EffectScope(detached);
}
function recordEffectScope(effect, scope = activeEffectScope) {
    if (scope && scope.active)
        scope.effects.push(effect);
}

const targetMap = new WeakMap();
let activeEffect;
let activeEffectStack = [];
let effectTrackDepth = 0;
let trackOpBit = 1;
const maxMarkerBits = 30;
class ReactiveEffect {
    constructor(fn, scheduler, scope) {
        this.fn = fn;
        this.scheduler = scheduler;
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
    if (!options || !options.lazy) {
        _effect.run();
    }
    const runner = _effect.run.bind(_effect);
    runner.effect = _effect;
    return runner;
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

const readonlyGet = createGetter(true);
function createGetter(isReadonly = false, shallow = false) {
    return (target, key, receiver) => {
        if (key === "__v_isReactive") {
            return !isReadonly;
        }
        const isExistInReactiveMap = () => {
            return key === "_v_raw" && receiver === reactiveMap.get(target);
        };
        const isExistInShallowReactiveMap = () => {
            return (key === "_v_raw" && receiver === shallowReactiveMap.get(target));
        };
        const isExistInReadonlyMap = () => {
            return key === "_v_raw" && receiver === readonlyMap.get(target);
        };
        if (isExistInReactiveMap() ||
            isExistInShallowReactiveMap() ||
            isExistInReadonlyMap())
            return target;
        if (!isReadonly) {
            track(target, key);
        }
        const res = Reflect.get(target, key, receiver);
        if (shallow) {
            return res;
        }
        if (isObject(res)) {
            return isReadonly ? readonly(res) : reactive(res);
        }
        return res;
    };
}
function createSetter() {
    return (target, key, newValue, receiver) => {
        Reflect.set(target, key, newValue, receiver);
        trigger(target, key);
        return true;
    };
}
const get = createGetter();
const set = createSetter();
const mutableHandlers = {
    get,
    set,
};
const shallowReactiveHandlers = {
    get: createGetter(false, true),
    set,
};
const readonlyHandlers = {
    get: readonlyGet,
    set(target, key) {
        console.warn(`Set operation on key "${String(key)}" failed: target is readonly.`, target);
        return true;
    },
};

var ReactiveFlag;
(function (ReactiveFlag) {
    ReactiveFlag["IS_REACTIVE"] = "__v_isReactive";
    ReactiveFlag["RAW"] = "_v_raw";
})(ReactiveFlag || (ReactiveFlag = {}));
const reactiveMap = new WeakMap();
const shallowReactiveMap = new WeakMap();
const readonlyMap = new WeakMap();
function reactive(target) {
    if (isReadonly(target)) {
        return target;
    }
    return createReactiveObject(target, false, mutableHandlers, reactiveMap);
}
function readonly(target) {
    return createReactiveObject(target, true, readonlyHandlers, readonlyMap);
}
function shallowReactive(target) {
    return createReactiveObject(target, false, shallowReactiveHandlers, shallowReactiveMap);
}
function createReactiveObject(target, isReadonly, baseHandlers, proxyMap) {
    if (target["_v_raw"] &&
        !(isReadonly && target["__v_isReactive"])) {
        return target;
    }
    const existingProxy = proxyMap.get(target);
    if (existingProxy) {
        return existingProxy;
    }
    const proxy = new Proxy(target, baseHandlers);
    proxyMap.set(target, proxy);
    return proxy;
}
function isReadonly(value) {
    return value && value["__v_isReadonly"];
}

class ComputedRefImpl {
    constructor(getter, setter) {
        this.dirty = true;
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
function computed(getterOrOptions) {
    let getter;
    let setter;
    const onlyGetter = isFunction(getterOrOptions);
    if (onlyGetter) {
        getter = getterOrOptions;
    }
    else {
        getter = getterOrOptions.get;
        setter = getterOrOptions.set;
    }
    const cRef = new ComputedRefImpl(getter, setter);
    return cRef;
}

const jobQueue = new Set();
let isFlushing = false;
const p = Promise.resolve();
const queueJob = (update) => {
    jobQueue.add(update);
    flushJob();
};
function flushJob() {
    if (isFlushing)
        return;
    p.then(() => {
        jobQueue.forEach((effect) => effect());
        isFlushing = false;
    });
}

function ref(value) {
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

exports.computed = computed;
exports.effect = effect;
exports.effectScope = effectScope;
exports.queueJob = queueJob;
exports.reactive = reactive;
exports.readonly = readonly;
exports.ref = ref;
exports.shallowReactive = shallowReactive;
exports.watch = watch;
//# sourceMappingURL=mini-vue.cjs.js.map
