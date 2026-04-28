/**
 * Quick galaxy inspection — run with: npx tsx scripts/inspect.ts
 * (or compile and node-run; this is dev-only)
 */
import { defaultGalaxy, generateAllGalaxies } from '../src/galaxy/generator';
import { describeSystem } from '../src/galaxy/describe';

const g = defaultGalaxy();

console.log('=== APHELION — Galaxy 0 ===');
console.log(`Total systems: ${g.systems.length}`);

console.log('\nFirst 12 systems:');
for (const s of g.systems.slice(0, 12)) {
  console.log(
    `  ${s.index.toString().padStart(3)} ${s.name.padEnd(11)} ` +
      `(${s.x.toString().padStart(3)},${s.y.toString().padStart(3)}) ` +
      `tech=${s.techLevel.toString().padStart(2)} ` +
      `${s.economy.padEnd(22)} ${s.government.padEnd(18)} ` +
      `pop=${s.population.toFixed(1)}B`,
  );
}

console.log('\n--- Sample descriptions ---');
for (const s of g.systems.slice(0, 12)) {
  console.log(`\n${s.name}:`);
  console.log(`  ${describeSystem(s)}`);
}

// Distribution sanity checks
const econs = new Map<string, number>();
const govs = new Map<string, number>();
for (const s of g.systems) {
  econs.set(s.economy, (econs.get(s.economy) ?? 0) + 1);
  govs.set(s.government, (govs.get(s.government) ?? 0) + 1);
}
console.log('\nEconomy distribution:');
for (const [k, v] of econs) console.log(`  ${k.padEnd(22)} ${v}`);
console.log('\nGovernment distribution:');
for (const [k, v] of govs) console.log(`  ${k.padEnd(20)} ${v}`);

const techs = g.systems.map((s) => s.techLevel);
console.log(
  `\nTech: min=${Math.min(...techs)} max=${Math.max(...techs)} avg=${(techs.reduce((a, b) => a + b, 0) / techs.length).toFixed(1)}`,
);

const allG = generateAllGalaxies();
console.log(`\nAll galaxies: ${allG.length}`);
for (let i = 0; i < allG.length; i++) {
  const first3 = allG[i]!.systems.slice(0, 3).map((s) => s.name).join(', ');
  console.log(`  Galaxy ${i + 1} ${allG[i]!.name.padEnd(12)} — ${first3}, ...`);
}
