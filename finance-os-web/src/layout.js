// Balance default grid rows without overriding user-selected widget sizes or ordering.
export function metricRows(n){const rows=[];while(n>3){if(n===4){rows.push(2,2);return rows}rows.push(3);n-=3}if(n)rows.push(n);return rows}
export function balanceGrid(root,custom=false){
 if(custom)return;const grid=root.querySelector('.grid');if(!grid)return;const items=[...grid.children];
 const isMetric=e=>e?.classList.contains('metric')&&!e.classList.contains('balance-pair');
 const isWide=e=>e?.classList.contains('wide')&&!e.classList.contains('balance-pair');
 for(let i=0;i<items.length-1;i++)if(isWide(items[i])&&isMetric(items[i+1])&&!isWide(items[i-1])&&!isMetric(items[i+2])){items[i].classList.add('balance-pair');items[i+1].classList.add('balance-pair');}
 for(let i=0;i<items.length;){
  if(isMetric(items[i])){let j=i;while(isMetric(items[j]))j++;let k=i;for(const n of metricRows(j-i)){for(let t=0;t<n;t++,k++)items[k].classList.add('balance-metric-'+n);}if((j-i)%2)items[j-1].classList.add('balance-mobile-last');i=j;continue}
  if(isWide(items[i])){let j=i;while(isWide(items[j]))j++;if((j-i)%2)items[j-1].classList.add('balance-wide-last');i=j;continue}
  if(items[i].classList.contains('chart-wide')&&!items[i+1]?.classList.contains('chart-narrow'))items[i].classList.add('balance-wide-last');
  if(items[i].classList.contains('chart-narrow')&&!items[i-1]?.classList.contains('chart-wide'))items[i].classList.add('balance-wide-last');i++;
 }
}
