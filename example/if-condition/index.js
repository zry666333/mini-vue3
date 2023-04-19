import { reactive, effect, effectScope } from "../../lib/mini-vue.esm.js";

const obj = reactive({
  flag: true,
  msg: "hello world",
});

const scope = effectScope();

scope.run(() => {
  effect(() => {
    if (obj.flag) {
      console.log(obj.msg);
    } else {
      console.log("hello effect");
    }
  });
});

obj.flag = false;

setTimeout(() => {
  obj.msg = "hi";
}, 2000);
