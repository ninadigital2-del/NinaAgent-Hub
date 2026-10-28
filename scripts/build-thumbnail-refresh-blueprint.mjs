import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const sourcePath = path.resolve(repo, '..', 'core-7214844-spm-fb-final.blueprint.json');
const outputPath = path.join(repo, 'UTILITY — Refresh Content Thumbnails v1.blueprint.json');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const clone = value => JSON.parse(JSON.stringify(value));
const webhook = {
  id: 1,
  module: 'gateway:CustomWebHook',
  version: 1,
  parameters: { hook: null, maxResults: 1 },
  mapper: {},
  metadata: {
    designer: { x: 0, y: 0 },
    restore: { parameters: { hook: { data: { editable: 'true' }, label: 'Thumbnail Refresh — Dashboard' } } },
    parameters: [
      { name: 'hook', type: 'hook:gateway-webhook', label: 'Webhook', required: true },
      { name: 'maxResults', type: 'number', label: 'Maximum number of results' },
    ],
    interface: [
      { name: 'clientId', type: 'text', label: 'Client ID' },
      { name: 'days', type: 'number', label: 'Days' },
      { name: 'requestedBy', type: 'text', label: 'Requested by' },
      { name: 'requestedAt', type: 'date', label: 'Requested at' },
    ],
  },
};

const configSearch = clone(source.flow[0]);
configSearch.metadata.designer = { x: 300, y: 0 };

const router = clone(source.flow[1]);
router.metadata.designer = { x: 600, y: 0 };
// Instagram posts, generic Facebook posts, and the SPM Page-token route.
router.routes = [router.routes[0], router.routes[3], router.routes[5]];

const clientCondition = {
  a: '{{contains(join(map(2.properties_value.Client; "id"); ","); 1.clientId)}}',
  o: 'boolean:istrue',
};
for (const route of router.routes) {
  const first = route.flow[0];
  if (first.filter?.conditions?.[0]) first.filter.conditions[0].push(clientCondition);
}

function rewrite(value) {
  if (typeof value === 'string') {
    return value
      .replaceAll(
        'addDays(setDay(addDays(now; -1); 2); -7)',
        'addDays(now; -1 * ifempty(1.days; 30))'
      )
      .replaceAll('addDays(setDay(addDays(now; -1); 2); -1)', 'now')
      .replaceAll(
        'addDays(setDay(now; "monday"); -7)',
        'addDays(now; -1 * ifempty(1.days; 30))'
      )
      .replaceAll('setDay(now; "monday")', 'now');
  }
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = rewrite(value[key]);
  }
  return value;
}
rewrite(router);

for (const node of [router.routes[0].flow[1], router.routes[1].flow[1], router.routes[2].flow[3]]) {
  if (node?.filter?.name) node.filter.name = node.filter.name
    .replace('previous week', 'selected window')
    .replace('Previous Mon-Sun', 'Selected window');
}

const blueprint = {
  name: 'UTILITY — Refresh Content Thumbnails v1',
  flow: [webhook, configSearch, router],
  metadata: {
    instant: true,
    version: 1,
    scenario: {
      roundtrips: 1,
      maxErrors: 3,
      autoCommit: true,
      autoCommitTriggerLast: true,
      sequential: true,
      slots: null,
      confidential: false,
      dataloss: false,
      dlq: false,
      freshVariables: false,
    },
    designer: { orphans: [] },
    zone: 'eu1.make.com',
    notes: [
      'Manual, PM-authenticated thumbnail refresh. Triggered only by the Content Performance GAS backend.',
      'The webhook payload is restricted to clientId and a 7/30/90-day window.',
    ],
  },
};

fs.writeFileSync(outputPath, JSON.stringify(blueprint, null, 2) + '\n');
console.log(outputPath);
