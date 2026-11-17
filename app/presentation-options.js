'use strict';
const PresentationOptions=(()=>{
 const defaultRows=5;
 let rows=defaultRows;
 const normalize=value=>Number.isInteger(value)&&value>=1&&value<=500?value:defaultRows;
 return {get rows(){return rows;},defaultRows,normalize,setRows(value){rows=normalize(value);}};
})();
