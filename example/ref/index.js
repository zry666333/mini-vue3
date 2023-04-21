import { ref, effectScope, effect } from "../../lib/mini-vue.esm.js";

const state = ref({
  msg: "hello world",
});

const scope = effectScope();

scope.run(() => {
  effect(() => {
    console.log(state.value);
  });
});

setTimeout(() => {
  state.value.msg = "hello vue3";
}, 1000);
