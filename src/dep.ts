import { trackOpBit} from './effect'

export const initDepMarkers = ({deps}) => {
  if (!deps.length) return;
  for(let i =0;i<deps.length;i++) {
    // 标记为已存在，挂载时依赖集为空
    deps[i].w |= trackOpBit 
  }
}

export const newTracked = (dep) => {
  return (dep.n & trackOpBit) > 0
}

export const wasTracked = (dep) => {
  return (dep.w & trackOpBit) > 0  
}

export const finalizeDepMarkers = (effect) => {
  const {deps} = effect;
  if (deps.length) {
    let ptr = 0;
    for(let i=0;i<deps.length;i++) {
      const dep = deps[i];
      if (wasTracked(dep) && !newTracked(dep)) {
        dep.delete(effect)
      } else {
        deps[ptr++] = dep
      }
      // 重置
      dep.w&=~trackOpBit;
      dep.n&=~trackOpBit;
    }
    deps.length=ptr
  }
}