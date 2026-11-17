'use strict';
// Copy-on-write experiment storage. Baseline keys are read-only migration sources.
const InfinityStorage=(()=>{
 const prefix='oligo.infinity.v1:';
 return {
  getItem(key){
   const value=localStorage.getItem(prefix+key);
   return value===null?localStorage.getItem(key):value;
  },
  setItem(key,value){localStorage.setItem(prefix+key,value);},
  prefix
 };
})();
