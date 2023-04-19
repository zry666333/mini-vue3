const jobQueue: Set<any> = new Set();
let isFlushing = false;

const p = Promise.resolve();

export const queueJob = (update) => {
  jobQueue.add(update);
  flushJob();
};

function flushJob() {
  if (isFlushing) return;
  p.then(() => {
    jobQueue.forEach((effect) => effect());
    isFlushing = false;
  });
}
