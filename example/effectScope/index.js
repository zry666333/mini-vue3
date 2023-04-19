import { reactive, effect, effectScope } from "../../lib/mini-vue.esm.js";

const obj = reactive({
  msg: "hello world",
});

const obj2 = reactive({
  msg: "hello effect",
});

const scope = effectScope();

scope.run(() => {
  effect(() => {
    scope.stop();
    console.log(obj.msg);
  });

  effect(() => {
    console.log(obj2.msg);
  });
});

setTimeout(() => {
  obj.msg = "1";
}, 1000);
