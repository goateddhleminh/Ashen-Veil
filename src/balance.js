// Campaign enemy health curve. Keeps the level-one baseline while preventing
// late-game trash from collapsing under gear-scaled player DPS.
export function campaignEnemyHealth(baseHealth, level=1, rank=0) {
  const n=Math.min(29,Math.max(1,Number(level)||1)-1);
  const levelScale=1 + n*.65 + n*n*.0015;
  return baseHealth*levelScale*(1+Math.max(0,Number(rank)||0)*.65);
}
