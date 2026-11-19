import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { validateEnv } from '../../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../../src/config/db.js';
import { Restaurant } from '../../src/models/index.js';
import { kmToMeters, kmToRadians } from '../../src/utils/geoHelpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXPERIMENTS_DIR = path.resolve(__dirname, '../../../docs/experiments');
const GOKULAM_POINT = [76.6258, 12.3282];

function extractStageStats(winningPlan) {
  const stages = [];
  const indexes = new Set();

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.stage) stages.push(node.stage);
    if (node.indexName) indexes.add(node.indexName);
    if (node.inputStage) walk(node.inputStage);
    if (Array.isArray(node.inputStages)) node.inputStages.forEach(walk);
  }

  walk(winningPlan);
  return {
    stages,
    indexUsed: Array.from(indexes).join(', ') || 'NONE (COLLSCAN)',
  };
}

function summarizeExplain(exp) {
  const stats = exp.executionStats || {};
  const plan = exp.queryPlanner?.winningPlan || {};
  const { stages, indexUsed } = extractStageStats(plan);
  return {
    stages: stages.join(' -> '),
    indexUsed,
    executionTimeMillis: stats.executionTimeMillis,
    totalKeysExamined: stats.totalKeysExamined,
    totalDocsExamined: stats.totalDocsExamined,
    nReturned: stats.nReturned,
  };
}

function generateSyntheticCoords(count) {
  const docs = [];
  for (let i = 0; i < count; i += 1) {
    const lng = 76.55 + ((i * 73) % 1000) / 5000;
    const lat = 12.24 + ((i * 47) % 1000) / 5000;
    docs.push({
      name: `Bench Kitchen ${i}`,
      isActive: true,
      location: { type: 'Point', coordinates: [Number(lng.toFixed(6)), Number(lat.toFixed(6))] },
    });
  }
  return docs;
}

function buildExp1Svg(scaleResults) {
  const maxDocs = Math.max(...scaleResults.map((r) => r.unindexedGeoWithin2km.totalDocsExamined), 100);
  const maxMs = Math.max(
    ...scaleResults.map((r) =>
      Math.max(
        r.unindexedGeoWithin2km.executionTimeMillis,
        r.indexedGeoWithin2km.executionTimeMillis,
        r.indexedNear2km.executionTimeMillis,
        1
      )
    ),
    5
  );

  const width = 920;
  const height = 430;
  const groupW = 240;

  let docsBars = '';
  let timeBars = '';

  scaleResults.forEach((row, idx) => {
    const gx = 70 + idx * (groupW + 40);
    const items = [
      { label: 'Unindexed COLLSCAN', val: row.unindexedGeoWithin2km.totalDocsExamined, ms: row.unindexedGeoWithin2km.executionTimeMillis, color: '#e11d48' },
      { label: '2dsphere $geoWithin', val: row.indexedGeoWithin2km.totalDocsExamined, ms: row.indexedGeoWithin2km.executionTimeMillis, color: '#0284c7' },
      { label: '2dsphere $near', val: row.indexedNear2km.totalDocsExamined, ms: row.indexedNear2km.executionTimeMillis, color: '#059669' },
    ];

    items.forEach((item, bIdx) => {
      const bx = gx + bIdx * 62;
      const dh = Math.max(4, Math.round((item.val / maxDocs) * 180));
      const dy = 260 - dh;
      docsBars += `<rect x="${bx}" y="${dy}" width="44" height="${dh}" rx="4" fill="${item.color}" />`;
      docsBars += `<text x="${bx + 22}" y="${dy - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="#1e293b">${item.val}</text>`;

      const th = Math.max(4, Math.round((item.ms / maxMs) * 75));
      const ty = 385 - th;
      timeBars += `<rect x="${bx}" y="${ty}" width="44" height="${th}" rx="4" fill="${item.color}" opacity="0.85" />`;
      timeBars += `<text x="${bx + 22}" y="${ty - 5}" text-anchor="middle" font-size="10" font-weight="700" fill="#1e293b">${item.ms}ms</text>`;
    });

    docsBars += `<text x="${gx + 84}" y="282" text-anchor="middle" font-size="12" font-weight="700" fill="#0f172a">${row.docCount} Docs Scale</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Segoe UI, Arial, sans-serif">
  <rect width="100%" height="100%" fill="#ffffff" rx="14" stroke="#e2e8f0" />
  <text x="32" y="34" font-size="17" font-weight="800" fill="#0f172a">Experiment 1: MongoDB 2dsphere Index vs Unindexed COLLSCAN (2 km Query)</text>
  <text x="32" y="54" font-size="12" fill="#475569">Measured live on MongoDB Atlas using explain("executionStats") across 500, 1,500, and 5,000 GeoJSON documents</text>
  <g transform="translate(510, 22)" font-size="11" font-weight="600" fill="#334155">
    <rect x="0" y="0" width="12" height="12" rx="2" fill="#e11d48" /><text x="18" y="10">Unindexed (COLLSCAN)</text>
    <rect x="148" y="0" width="12" height="12" rx="2" fill="#0284c7" /><text x="166" y="10">Indexed $geoWithin</text>
    <rect x="280" y="0" width="12" height="12" rx="2" fill="#059669" /><text x="298" y="10">Indexed $near</text>
  </g>
  <line x1="48" y1="260" x2="880" y2="260" stroke="#cbd5e1" stroke-width="1.5" />
  <text x="24" y="165" font-size="11" font-weight="700" fill="#475569" transform="rotate(-90 24 165)" text-anchor="middle">Documents Examined</text>
  ${docsBars}
  <line x1="48" y1="385" x2="880" y2="385" stroke="#cbd5e1" stroke-width="1.5" />
  <text x="24" y="345" font-size="11" font-weight="700" fill="#475569" transform="rotate(-90 24 345)" text-anchor="middle">Exec Time (ms)</text>
  ${timeBars}
</svg>`;
}

async function runScaleCase(docCount) {
  const tempName = `geo_benchmark_temp_${docCount}_${Date.now()}`;
  const tempCol = mongoose.connection.db.collection(tempName);

  try {
    await tempCol.insertMany(generateSyntheticCoords(docCount));

    const unindexedExplain = await tempCol
      .find({
        isActive: true,
        location: { $geoWithin: { $centerSphere: [GOKULAM_POINT, kmToRadians(2)] } },
      })
      .explain('executionStats');

    await tempCol.createIndex({ location: '2dsphere' });

    const indexedGeoWithinExplain = await tempCol
      .find({
        isActive: true,
        location: { $geoWithin: { $centerSphere: [GOKULAM_POINT, kmToRadians(2)] } },
      })
      .explain('executionStats');

    const indexedNearExplain = await tempCol
      .find({
        isActive: true,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: GOKULAM_POINT },
            $maxDistance: kmToMeters(2),
          },
        },
      })
      .explain('executionStats');

    const unindexed = summarizeExplain(unindexedExplain);
    const indexedWithin = summarizeExplain(indexedGeoWithinExplain);
    const indexedNear = summarizeExplain(indexedNearExplain);

    const docScanReductionPct = unindexed.totalDocsExamined
      ? Number(
          (
            ((unindexed.totalDocsExamined - indexedWithin.totalDocsExamined) /
              unindexed.totalDocsExamined) *
            100
          ).toFixed(1)
        )
      : 0;

    return {
      docCount,
      unindexedGeoWithin2km: unindexed,
      indexedGeoWithin2km: indexedWithin,
      indexedNear2km: indexedNear,
      docScanReductionPct,
    };
  } finally {
    await tempCol.drop().catch(() => {});
  }
}

async function runBenchmark() {
  validateEnv();
  await connectDatabase();

  try {
    const prodNearExplain = await Restaurant.collection
      .find({
        isActive: true,
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: GOKULAM_POINT },
            $maxDistance: kmToMeters(5),
          },
        },
      })
      .explain('executionStats');

    const prodWithinExplain = await Restaurant.collection
      .find({
        isActive: true,
        location: {
          $geoWithin: { $centerSphere: [GOKULAM_POINT, kmToRadians(5)] },
        },
      })
      .explain('executionStats');

    const scales = [];
    for (const count of [500, 1500, 5000]) {
      scales.push(await runScaleCase(count));
    }

    const report = {
      generatedAt: new Date().toISOString(),
      centerGeoJson: GOKULAM_POINT,
      productionRestaurants: {
        near5km: summarizeExplain(prodNearExplain),
        geoWithin5km: summarizeExplain(prodWithinExplain),
      },
      scaleBenchmarks2km: scales,
    };

    await fs.mkdir(EXPERIMENTS_DIR, { recursive: true });
    await fs.writeFile(
      path.join(EXPERIMENTS_DIR, 'exp1_geospatial_results.json'),
      JSON.stringify(report, null, 2)
    );
    await fs.writeFile(
      path.join(EXPERIMENTS_DIR, 'exp1_geospatial_benchmark.svg'),
      buildExp1Svg(scales)
    );

    console.log('GEO_BENCHMARK_RESULTS:');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await disconnectDatabase();
  }
}

runBenchmark().catch((err) => {
  console.error('BENCHMARK_FAILED:', err.message);
  process.exit(1);
});
