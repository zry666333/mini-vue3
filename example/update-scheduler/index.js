import {
  reactive,
  effect,
  queueJob,
  effectScope,
} from "../../lib/mini-vue.esm.js";

const obj = reactive({
  msg: "hello world",
});

const scope = effectScope();

scope.run(() => {
  const update = effect(
    () => {
      console.log(obj.msg);
    },
    {
      scheduler() {
        return queueJob(update);
      },
    }
  );
});

obj.msg = "hello vue3";
console.log("first");
