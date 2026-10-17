import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePressureMPa,
  computeEconomicTick,
  discoverNodesInSonarRadius,
  findNearestNode,
  formatAsciiBar,
  getMaxCrushDepthMeters,
  getSeafloorDepthMeters,
  getSonarPingRadius,
  getUpgradeCost,
  isHullIntegrityWarning,
} from './rules.ts';

test('calculatePressureMPa computes realistic hydrostatic pressure', () => {
  assert.equal(calculatePressureMPa(0), 0.1);
  assert.equal(calculatePressureMPa(-3420), 34.6);
  assert.equal(calculatePressureMPa(-6000), 60.6);
});

test('getMaxCrushDepthMeters scales by -1500m per hull tier', () => {
  assert.equal(getMaxCrushDepthMeters(1), -4500);
  assert.equal(getMaxCrushDepthMeters(2), -6000);
  assert.equal(getMaxCrushDepthMeters(3), -7500);
});

test('isHullIntegrityWarning triggers near and beyond crush limit', () => {
  assert.equal(isHullIntegrityWarning(-3420, -4500), false);
  assert.equal(isHullIntegrityWarning(-4250, -4500), true);
  assert.equal(isHullIntegrityWarning(-4800, -4500), true);
});

test('formatAsciiBar renders exact block proportions', () => {
  assert.equal(formatAsciiBar(0.8, 10), '[████████░░]');
  assert.equal(formatAsciiBar(0, 10), '[░░░░░░░░░░]');
  assert.equal(formatAsciiBar(1, 10), '[██████████]');
});

test('computeEconomicTick updates credits, solar kW, distilled H2O, and battery', () => {
  const result = computeEconomicTick({
    credits: 14850,
    distilledH2O: 1240,
    rareNodules: 68,
    batteryCells: 12,
    batteryPercent: 78.4,
    depthMeters: -3420,
    floodlightsOn: true,
    isThrusting: false,
    infrastructure: {
      solarBarges: 4,
      relayDrones: 2,
      distillationRigs: 2,
      seabedHarvesters: 1,
    },
    upgrades: {
      hullTier: 1,
      capacitorTier: 1,
      sonarTier: 1,
    },
    discoveredNodesCount: 3,
  });

  assert.equal(result.solarKw, 180);
  assert.equal(result.creditRatePerSec, 17 + 25 + 9);
  assert.equal(result.credits, 14850 + 51);
  assert.equal(result.distilledH2O, 1240 + 30);
  assert.ok(result.rareNodules > 68);
});

test('discoverNodesInSonarRadius reveals nodes inside ping radius', () => {
  const nodes = [
    {
      id: 'n1',
      code: 'VENT-01',
      name: 'Hadal Black Smoker',
      type: 'VENT' as const,
      x: 10,
      z: 10,
      depthMeters: -3800,
      discovered: false,
      harvestedCount: 0,
      maxYield: 5,
      creditValue: 450,
      noduleYield: 8,
    },
    {
      id: 'n2',
      code: 'NOD-02',
      name: 'Abyssal Manganese Field',
      type: 'NODULE' as const,
      x: 90,
      z: 90,
      depthMeters: -4400,
      discovered: false,
      harvestedCount: 0,
      maxYield: 5,
      creditValue: 520,
      noduleYield: 14,
    },
  ];

  const { updatedNodes, newlyDiscovered } = discoverNodesInSonarRadius(nodes, 0, 0, 30);
  assert.equal(newlyDiscovered.length, 1);
  assert.equal(newlyDiscovered[0].id, 'n1');
  assert.equal(updatedNodes[0].discovered, true);
  assert.equal(updatedNodes[1].discovered, false);

  const { distanceMeters } = findNearestNode(updatedNodes, 10, 10);
  assert.equal(distanceMeters, 0);
});

test('bathymetric terrain depth and upgrade scaling return valid numbers', () => {
  const centerDepth = getSeafloorDepthMeters(0, 0);
  const ridgeDepth = getSeafloorDepthMeters(0, 85);
  assert.ok(centerDepth < ridgeDepth, 'Central trench should be deeper than outer shelf');
  assert.ok(getSonarPingRadius(2) > getSonarPingRadius(1));
  assert.ok(getUpgradeCost('hullTier', 2) > getUpgradeCost('hullTier', 1));
});
