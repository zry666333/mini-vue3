import {
  shallowReactive,
  effect,
  queueJob,
  effectScope,
} from "../../lib/mini-vue.esm.js";

const obj = shallowReactive({
  msg: "hello world",
  data: {
    msg: "hello vue3",
  },
});

const scope = effectScope();

scope.run(() => {
  const update = effect(
    () => {
      console.log(obj.msg);
      console.log(obj.data.msg);
    },
    {
      scheduler() {
        return queueJob(update);
      },
    }
  );
});

// obj.msg = "hello vue3";
obj.data.msg = "修改";
console.log("first");
