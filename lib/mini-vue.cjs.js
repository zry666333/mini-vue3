'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const targetMap = new WeakMap();
let activeEffect;
let activeEffectStack = [];
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
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
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
        if (effect.options) {
            const { scheduler } = effect.options;
            scheduler && scheduler(effect);
        }
        else {
            effect();
        }
    });
}
function cleanup(effect) {
    effect.deps.forEach((dep) => {
        dep.delete(effect);
    });
    effect.deps = [];
}
function effect(fn, options) {
    function effectFn() {
        activeEffect = effectFn;
        activeEffectStack.push(effectFn);
        cleanup(activeEffect);
        const res = fn();
        activeEffectStack.pop();
        activeEffect = activeEffectStack[activeEffectStack.length - 1];
        return res;
    }
    if (!effectFn.deps)
        effectFn.deps = [];
    options && (effectFn.options = options);
    if (options && options.lazy) {
        return effectFn;
    }
    effectFn();
}
Promise.resolve();
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

exports.computed = computed;
exports.track = track;
exports.trigger = trigger;
exports.watch = watch;
//# sourceMappingURL=mini-vue.cjs.js.map
