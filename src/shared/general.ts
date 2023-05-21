
// 比较值是否发生变化，包括NaN
export const hasChanged = (value:any, oldValue:any):boolean => 
  !Object.is(value, oldValue)

export const isArray = Array.isArray
