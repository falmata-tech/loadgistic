export function paginateResults(rows,options={}){
  const pageSize=Math.max(1,Math.min(100,Number(options.pageSize)||12));
  const page=Math.max(1,Number(options.page)||1);
  const total=Array.isArray(rows)?rows.length:0;
  const pageCount=Math.max(1,Math.ceil(total/pageSize));
  const safePage=Math.min(page,pageCount);
  return {items:(rows||[]).slice((safePage-1)*pageSize,safePage*pageSize),total,page:safePage,pageSize,pageCount};
}

// RPCs with a total on each returned row lose that total beyond the last page.
// Recover at most one bounded first page, keeping filtering/authority in the caller.
export async function readWindowedPage(loadRows,options={},maximumPageSize=50){
  const requestedPage=Number(options.page),requestedSize=Number(options.pageSize);
  let page=Number.isSafeInteger(requestedPage)&&requestedPage>0&&requestedPage<=1_000_000?requestedPage:1;
  const pageSize=Number.isSafeInteger(requestedSize)&&requestedSize>0?Math.min(maximumPageSize,requestedSize):12;
  let rows=await loadRows((page-1)*pageSize,pageSize);
  if(page>1&&!rows.length){page=1;rows=await loadRows(0,pageSize);}
  const total=Number(rows[0]?.total_count||0);
  return {items:rows.map(row=>row?.payload||row),total,page,pageSize,pageCount:Math.max(1,Math.ceil(total/pageSize))};
}
