import { reactive, computed, effectScope } from "../../lib/mini-vue.esm.js";

const state = reactive({
  name: "hello",
});

const scope = effectScope();

scope.run(() => {
  const computedValue = computed(() => {
    console.log("computed执行");
    return state.name + " vue3";
  });

  console.log(computedValue.value);

  setTimeout(() => {
    state.name = "nnn";
    console.log(computedValue.value);
  }, 3000);
});
