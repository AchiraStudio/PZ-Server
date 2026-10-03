/**
 * Project Zomboid Configuration Parsers
 * Handles server.ini and SandboxVars.lua parsing and serialization.
 */

// ==========================================
// INI PARSER & SERIALIZER (server.ini)
// ==========================================

function parseIni(content) {
  const lines = content.split(/\r?\n/);
  const result = {};
  const rawLines = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      rawLines.push({ type: 'comment', value: line });
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1) {
      const key = line.substring(0, eqIdx).trim();
      const val = line.substring(eqIdx + 1).trim();
      result[key] = val;
      rawLines.push({ type: 'kv', key, value: val });
    } else {
      rawLines.push({ type: 'raw', value: line });
    }
  }

  return { data: result, rawLines };
}

function serializeIni(data, originalRawLines = []) {
  if (!originalRawLines || originalRawLines.length === 0) {
    // Generate clean INI
    const lines = [];
    for (const [key, value] of Object.entries(data)) {
      lines.push(`${key}=${value}`);
    }
    return lines.join('\n') + '\n';
  }

  // Preserve existing comments and order where possible
  const seenKeys = new Set();
  const output = [];

  for (const item of originalRawLines) {
    if (item.type === 'comment' || item.type === 'raw') {
      output.push(item.value);
    } else if (item.type === 'kv') {
      seenKeys.add(item.key);
      if (item.key in data) {
        output.push(`${item.key}=${data[item.key]}`);
      }
    }
  }

  // Append any newly added keys
  for (const [key, value] of Object.entries(data)) {
    if (!seenKeys.has(key)) {
      output.push(`${key}=${value}`);
    }
  }

  return output.join('\n') + '\n';
}

// ==========================================
// LUA TABLE PARSER & SERIALIZER (SandboxVars.lua)
// ==========================================

function parseLuaTable(content) {
  // Strip comments first while preserving strings
  // Simple tokenizer
  let pos = 0;
  const len = content.length;

  function skipWhitespaceAndComments() {
    while (pos < len) {
      const ch = content[pos];
      if (/\s/.test(ch)) {
        pos++;
        continue;
      }
      if (ch === '-' && content[pos + 1] === '-') {
        // Comment
        pos += 2;
        if (content[pos] === '[' && content[pos + 1] === '[') {
          // Block comment --[[ ... ]]
          pos += 2;
          while (pos < len && !(content[pos] === ']' && content[pos + 1] === ']')) {
            pos++;
          }
          pos += 2;
        } else {
          // Line comment
          while (pos < len && content[pos] !== '\n') {
            pos++;
          }
        }
        continue;
      }
      break;
    }
  }

  function parseString() {
    const quote = content[pos];
    pos++; // skip opening quote
    let str = '';
    while (pos < len) {
      const ch = content[pos];
      if (ch === '\\') {
        pos++;
        str += content[pos] || '';
        pos++;
      } else if (ch === quote) {
        pos++; // skip closing quote
        return str;
      } else {
        str += ch;
        pos++;
      }
    }
    return str;
  }

  function parseNumberOrIdentifier() {
    let token = '';
    while (pos < len && /[a-zA-Z0-9_.\-+]/.test(content[pos])) {
      token += content[pos];
      pos++;
    }
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token === 'nil') return null;
    const num = Number(token);
    if (!isNaN(num) && token.trim() !== '') return num;
    return token;
  }

  function parseValue() {
    skipWhitespaceAndComments();
    if (pos >= len) return null;

    const ch = content[pos];
    if (ch === '"' || ch === "'") {
      return parseString();
    }
    if (ch === '{') {
      return parseTable();
    }
    return parseNumberOrIdentifier();
  }

  function parseTable() {
    const result = {};
    let arrayIndex = 1;
    let isArray = true;
    const arrayElements = [];

    pos++; // skip '{'

    while (pos < len) {
      skipWhitespaceAndComments();
      if (pos >= len || content[pos] === '}') {
        pos++; // skip '}'
        break;
      }

      // Check key
      let key = null;
      if (content[pos] === '[') {
        pos++; // skip '['
        skipWhitespaceAndComments();
        if (content[pos] === '"' || content[pos] === "'") {
          key = parseString();
        } else {
          key = parseNumberOrIdentifier();
        }
        skipWhitespaceAndComments();
        if (content[pos] === ']') pos++;
        skipWhitespaceAndComments();
        if (content[pos] === '=') pos++;
      } else {
        // Read potential identifier or value
        const start = pos;
        let ident = '';
        while (pos < len && /[a-zA-Z0-9_]/.test(content[pos])) {
          ident += content[pos];
          pos++;
        }

        skipWhitespaceAndComments();
        if (content[pos] === '=') {
          key = ident;
          pos++; // skip '='
        } else {
          // Not a key=value, it's an array value
          pos = start;
          const val = parseValue();
          arrayElements.push(val);
          skipWhitespaceAndComments();
          if (content[pos] === ',' || content[pos] === ';') pos++;
          continue;
        }
      }

      const val = parseValue();
      if (key !== null) {
        isArray = false;
        result[key] = val;
      }

      skipWhitespaceAndComments();
      if (content[pos] === ',' || content[pos] === ';') {
        pos++;
      }
    }

    if (isArray && arrayElements.length > 0) {
      return arrayElements;
    }
    return result;
  }

  // Find SandboxVars = { ... }
  const match = content.match(/SandboxVars\s*=\s*\{/);
  if (match) {
    pos = match.index + match[0].length - 1; // position at '{'
    return parseTable();
  }

  // Fallback: look for first '{'
  const firstBrace = content.indexOf('{');
  if (firstBrace !== -1) {
    pos = firstBrace;
    return parseTable();
  }

  return {};
}

function serializeLuaValue(val, indent = 4) {
  const spaces = ' '.repeat(indent);
  const innerSpaces = ' '.repeat(indent + 4);

  if (val === null || val === undefined) return 'nil';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return Number.isInteger(val) ? val.toString() : val.toFixed(2);
  if (typeof val === 'string') {
    // Check if string needs quotes or is raw
    return JSON.stringify(val);
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return '{}';
    const items = val.map(item => serializeLuaValue(item, indent + 4));
    return `{\n${innerSpaces}${items.join(`,\n${innerSpaces}`)},\n${spaces}}`;
  }

  if (typeof val === 'object') {
    const keys = Object.keys(val);
    if (keys.length === 0) return '{}';
    const lines = [];
    for (const k of keys) {
      const v = val[k];
      const validIdent = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k);
      const keyStr = validIdent ? k : `[${JSON.stringify(k)}]`;
      lines.push(`${innerSpaces}${keyStr} = ${serializeLuaValue(v, indent + 4)},`);
    }
    return `{\n${lines.join('\n')}\n${spaces}}`;
  }

  return String(val);
}

function serializeSandboxVars(varsObj) {
  const body = [];
  const indent = '    ';

  // Keep VERSION first if present
  const keys = Object.keys(varsObj);
  const sortedKeys = [...keys].sort((a, b) => {
    if (a === 'VERSION') return -1;
    if (b === 'VERSION') return 1;
    // Objects towards the end
    const aIsObj = typeof varsObj[a] === 'object' && varsObj[a] !== null;
    const bIsObj = typeof varsObj[b] === 'object' && varsObj[b] !== null;
    if (!aIsObj && bIsObj) return -1;
    if (aIsObj && !bIsObj) return 1;
    return a.localeCompare(b);
  });

  for (const key of sortedKeys) {
    const val = varsObj[key];
    const validIdent = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key);
    const keyStr = validIdent ? key : `[${JSON.stringify(key)}]`;
    body.push(`${indent}${keyStr} = ${serializeLuaValue(val, 4)},`);
  }

  return `SandboxVars = {\n${body.join('\n')}\n}\n`;
}

// Sandbox schema & definitions for GUI rendering with friendly descriptions & dropdowns
const SANDBOX_SCHEMA = {
  Zombies: {
    category: 'Population',
    label: 'Zombie Count',
    type: 'select',
    options: [
      { value: 1, label: 'Insane' },
      { value: 2, label: 'High' },
      { value: 3, label: 'Normal' },
      { value: 4, label: 'Low' },
      { value: 5, label: 'None' }
    ],
    description: 'Controls the general population density of zombies in the world.'
  },
  Distribution: {
    category: 'Population',
    label: 'Zombie Distribution',
    type: 'select',
    options: [
      { value: 1, label: 'Urban Focused' },
      { value: 2, label: 'Uniform / Spread Out' }
    ],
    description: 'Urban-focused gathers zombies in towns; Uniform spreads them across rural areas too.'
  },
  DayLength: {
    category: 'Time & World',
    label: 'Day Length',
    type: 'select',
    options: [
      { value: 1, label: '30 Minutes' },
      { value: 2, label: '1 Hour (Default)' },
      { value: 3, label: '2 Hours' },
      { value: 4, label: '3 Hours' },
      { value: 5, label: '4 Hours' },
      { value: 6, label: '5 Hours' },
      { value: 7, label: '12 Hours' },
      { value: 8, label: '24 Hours (Real Time)' }
    ],
    description: 'Real-world time for a full 24-hour day in game.'
  },
  StartMonth: {
    category: 'Time & World',
    label: 'Start Month',
    type: 'select',
    options: [
      { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
      { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
      { value: 7, label: 'July (Default)' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
      { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
    ],
    description: 'Month the apocalypse begins.'
  },
  WaterShut: {
    category: 'Time & World',
    label: 'Water Shutoff',
    type: 'select',
    options: [
      { value: 1, label: 'Instant' },
      { value: 2, label: '0-30 Days' },
      { value: 3, label: '0-2 Months' },
      { value: 4, label: '0-6 Months' },
      { value: 5, label: '0-1 Year' },
      { value: 6, label: '0-5 Years' },
      { value: 7, label: 'Never' }
    ],
    description: 'When running tap water will shut down.'
  },
  ElecShut: {
    category: 'Time & World',
    label: 'Electricity Shutoff',
    type: 'select',
    options: [
      { value: 1, label: 'Instant' },
      { value: 2, label: '0-30 Days' },
      { value: 3, label: '0-2 Months' },
      { value: 4, label: '0-6 Months' },
      { value: 5, label: '0-1 Year' },
      { value: 6, label: '0-5 Years' },
      { value: 7, label: 'Never' }
    ],
    description: 'When power grid shuts down.'
  },
  FoodLoot: {
    category: 'Loot Rarity',
    label: 'Fresh Food Rarity',
    type: 'select',
    options: [
      { value: 1, label: 'Extremely Rare' },
      { value: 2, label: 'Rare' },
      { value: 3, label: 'Normal' },
      { value: 4, label: 'Common' },
      { value: 5, label: 'Abundant' }
    ],
    description: 'Availability of perishable fresh food.'
  },
  CannedFoodLoot: {
    category: 'Loot Rarity',
    label: 'Canned Food Rarity',
    type: 'select',
    options: [
      { value: 1, label: 'Extremely Rare' },
      { value: 2, label: 'Rare' },
      { value: 3, label: 'Normal' },
      { value: 4, label: 'Common' },
      { value: 5, label: 'Abundant' }
    ],
    description: 'Availability of non-perishable canned food.'
  },
  WeaponLoot: {
    category: 'Loot Rarity',
    label: 'Melee Weapons',
    type: 'select',
    options: [
      { value: 1, label: 'Extremely Rare' },
      { value: 2, label: 'Rare' },
      { value: 3, label: 'Normal' },
      { value: 4, label: 'Common' },
      { value: 5, label: 'Abundant' }
    ],
    description: 'Availability of knives, bats, axes, crowbars.'
  },
  RangedWeaponLoot: {
    category: 'Loot Rarity',
    label: 'Firearms Rarity',
    type: 'select',
    options: [
      { value: 1, label: 'Extremely Rare' },
      { value: 2, label: 'Rare' },
      { value: 3, label: 'Normal' },
      { value: 4, label: 'Common' },
      { value: 5, label: 'Abundant' }
    ],
    description: 'Availability of guns.'
  },
  AmmoLoot: {
    category: 'Loot Rarity',
    label: 'Ammunition Rarity',
    type: 'select',
    options: [
      { value: 1, label: 'Extremely Rare' },
      { value: 2, label: 'Rare' },
      { value: 3, label: 'Normal' },
      { value: 4, label: 'Common' },
      { value: 5, label: 'Abundant' }
    ],
    description: 'Availability of ammo boxes and magazines.'
  },
  MedicalLoot: {
    category: 'Loot Rarity',
    label: 'Medical Supplies',
    type: 'select',
    options: [
      { value: 1, label: 'Extremely Rare' },
      { value: 2, label: 'Rare' },
      { value: 3, label: 'Normal' },
      { value: 4, label: 'Common' },
      { value: 5, label: 'Abundant' }
    ],
    description: 'Availability of bandages, disinfectants, pills.'
  },
  XpMultiplier: {
    category: 'Character',
    label: 'XP Multiplier',
    type: 'number',
    step: 0.1,
    min: 0.1,
    max: 100.0,
    description: 'Multiplier for all skill experience gained by players (Default 1.0).'
  },
  'ZombieLore.Speed': {
    category: 'Zombie Lore',
    label: 'Zombie Speed',
    type: 'select',
    options: [
      { value: 1, label: 'Sprinters 🏃' },
      { value: 2, label: 'Fast Shamblers 🚶' },
      { value: 3, label: 'Shamblers 🐌' },
      { value: 4, label: 'Random' }
    ],
    description: 'Movement speed of zombies.'
  },
  'ZombieLore.Strength': {
    category: 'Zombie Lore',
    label: 'Zombie Strength',
    type: 'select',
    options: [
      { value: 1, label: 'Superhuman' },
      { value: 2, label: 'Normal' },
      { value: 3, label: 'Weak' },
      { value: 4, label: 'Random' }
    ],
    description: 'Physical damage inflicted by zombies.'
  },
  'ZombieLore.Toughness': {
    category: 'Zombie Lore',
    label: 'Zombie Toughness',
    type: 'select',
    options: [
      { value: 1, label: 'Tough' },
      { value: 2, label: 'Normal' },
      { value: 3, label: 'Fragile' },
      { value: 4, label: 'Random' }
    ],
    description: 'How difficult zombies are to put down.'
  },
  'ZombieLore.Transmission': {
    category: 'Zombie Lore',
    label: 'Infection Transmission',
    type: 'select',
    options: [
      { value: 1, label: 'Blood + Saliva (Scratches & Bites)' },
      { value: 2, label: 'Saliva Only (Bites Only)' },
      { value: 3, label: 'Everyone is Infected' },
      { value: 4, label: 'None (Immune)' }
    ],
    description: 'Method by which the Knox virus spreads.'
  },
  'ZombieLore.Mortality': {
    category: 'Zombie Lore',
    label: 'Infection Mortality',
    type: 'select',
    options: [
      { value: 1, label: 'Instant' },
      { value: 2, label: '0-30 Seconds' },
      { value: 3, label: '0-1 Minutes' },
      { value: 4, label: '0-12 Hours' },
      { value: 5, label: '2-3 Days (Default)' },
      { value: 6, label: '1-2 Weeks' },
      { value: 7, label: 'Never' }
    ],
    description: 'Time until death once infected.'
  },
  'ZombieLore.Reanimate': {
    category: 'Zombie Lore',
    label: 'Reanimation Time',
    type: 'select',
    options: [
      { value: 1, label: 'Instant' },
      { value: 2, label: '0-30 Seconds' },
      { value: 3, label: '0-1 Minutes' },
      { value: 4, label: '0-12 Hours' },
      { value: 5, label: '2-3 Days' }
    ],
    description: 'Time after death before a corpse reanimates.'
  },
  'ZombieLore.Cognition': {
    category: 'Zombie Lore',
    label: 'Cognition',
    type: 'select',
    options: [
      { value: 1, label: 'Navigate + Open Doors' },
      { value: 2, label: 'Navigate' },
      { value: 3, label: 'Basic Navigation' },
      { value: 4, label: 'Random' }
    ],
    description: 'Intelligence of zombies (can they open doors?).'
  },
  'ZombieLore.Memory': {
    category: 'Zombie Lore',
    label: 'Memory',
    type: 'select',
    options: [
      { value: 1, label: 'Long' },
      { value: 2, label: 'Normal' },
      { value: 3, label: 'Short' },
      { value: 4, label: 'None' }
    ],
    description: 'How long zombies remember seeing or hearing a player.'
  },
  'ZombieLore.Sight': {
    category: 'Zombie Lore',
    label: 'Sight',
    type: 'select',
    options: [
      { value: 1, label: 'Eagle' },
      { value: 2, label: 'Normal' },
      { value: 3, label: 'Poor' }
    ],
    description: 'Zombie visual detection radius.'
  },
  'ZombieLore.Hearing': {
    category: 'Zombie Lore',
    label: 'Hearing',
    type: 'select',
    options: [
      { value: 1, label: 'Pinpoint' },
      { value: 2, label: 'Normal' },
      { value: 3, label: 'Poor' }
    ],
    description: 'Zombie hearing distance.'
  },
  'ZombieConfig.PopulationMultiplier': {
    category: 'Population Multipliers',
    label: 'Population Multiplier',
    type: 'number',
    step: 0.1,
    min: 0.0,
    max: 4.0,
    description: 'Base multiplier on standard zombie population.'
  },
  'ZombieConfig.PopulationPeakMultiplier': {
    category: 'Population Multipliers',
    label: 'Peak Multiplier',
    type: 'number',
    step: 0.1,
    min: 0.0,
    max: 4.0,
    description: 'Multiplier on peak day.'
  },
  'ZombieConfig.PopulationPeakDay': {
    category: 'Population Multipliers',
    label: 'Peak Day',
    type: 'number',
    step: 1,
    min: 1,
    max: 365,
    description: 'Day when zombie population reaches its peak (Default 28).'
  },
  'ZombieConfig.RespawnHours': {
    category: 'Population Multipliers',
    label: 'Respawn Hours',
    type: 'number',
    step: 1,
    min: 0,
    max: 1000,
    description: 'Hours before zombies respawn in a chunk (0 = disabled).'
  }
};

module.exports = {
  parseIni,
  serializeIni,
  parseLuaTable,
  serializeSandboxVars,
  SANDBOX_SCHEMA
};
