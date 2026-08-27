export function paginateResults(rows,options={}){
  const pageSize=Math.max(1,Math.min(100,Number(options.pageSize)||12));
  const page=Math.max(1,Number(options.page)||1);
  const total=Array.isArray(rows)?rows.length:0;
  const pageCount=Math.max(1,Math.ceil(total/pageSize));
  const safePage=Math.min(page,pageCount);
  return {items:(rows||[]).slice((safePage-1)*pageSize,safePage*pageSize),total,page:safePage,pageSize,pageCount};
}
