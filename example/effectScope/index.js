import { reactive, effect, effectScope } from "../../lib/mini-vue.esm.js";

const obj = reactive({
  msg: "hello world",
});

const scope = effectScope();

scope.run(() => {
  effect(() => {
    // scope.stop();
    console.log("1", obj.msg);
    effect(() => {
      console.log("2", obj.msg);
    });
  });
});

setTimeout(() => {
  obj.msg = "hello";
}, 1000);
