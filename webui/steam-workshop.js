const https = require('https');
const querystring = require('querystring');

function httpPost(url, data) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify(data);
    const parsedUrl = new URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Steam API request timed out'));
    });

    req.write(postData);
    req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    };

    https.get(url, options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

function extractId(input) {
  if (!input) return null;
  const str = input.toString().trim();
  const match = str.match(/id=(\d+)/i) || str.match(/^(\d+)$/);
  return match ? match[1] : null;
}

/**
 * Fetch child Workshop IDs from a Steam Collection
 */
async function fetchCollection(collectionInput) {
  const collectionId = extractId(collectionInput);
  if (!collectionId) {
    throw new Error('Invalid collection ID or URL provided');
  }

  let childIds = [];
  let collectionTitle = `Collection #${collectionId}`;

  // Method 1: Try official Steam Web API
  try {
    const apiRes = await httpPost('https://api.steampowered.com/ISteamRemoteStorage/GetCollectionDetails/v1/', {
      collectioncount: 1,
      'publishedfileids[0]': collectionId
    });

    if (apiRes && apiRes.response && apiRes.response.collectiondetails) {
      const details = apiRes.response.collectiondetails[0];
      if (details.children && Array.isArray(details.children)) {
        for (const child of details.children) {
          if (child.publishedfileid) {
            childIds.push(child.publishedfileid.toString());
          }
        }
      }
    }
  } catch (err) {
    console.warn('[SteamWorkshop] API GetCollectionDetails failed, falling back to HTML scrape:', err.message);
  }

  // Method 2: Scrape Steam Collection web page (also grabs collection title & fallback items)
  try {
    const pageHtml = await httpGet(`https://steamcommunity.com/sharedfiles/filedetails/?id=${collectionId}`);

    const titleMatch = pageHtml.match(/<div class="workshopItemTitle">([\s\S]*?)<\/div>/i);
    if (titleMatch) {
      collectionTitle = titleMatch[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    }

    if (childIds.length === 0) {
      // Look for collection item container
      const itemMatches = [...pageHtml.matchAll(/id="item_(\d+)"/g)].map(m => m[1]);
      if (itemMatches.length > 0) {
        childIds = [...new Set(itemMatches)];
      } else {
        // Fallback: look for sharedfiles links inside collection section
        const linkMatches = [...pageHtml.matchAll(/sharedfiles\/filedetails\/\?id=(\d+)/g)].map(m => m[1]);
        // Filter out the collection's own ID
        childIds = [...new Set(linkMatches.filter(id => id !== collectionId))];
      }
    }
  } catch (err) {
    console.warn('[SteamWorkshop] HTML scrape failed:', err.message);
  }

  if (childIds.length === 0) {
    // If not a collection, perhaps user passed a single workshop item ID
    childIds.push(collectionId);
  }

  return {
    collectionId,
    title: collectionTitle,
    itemCount: childIds.length,
    workshopIds: childIds
  };
}

/**
 * Fetch title, thumbnail and parse Mod IDs from item description
 */
async function fetchModDetails(workshopId) {
  try {
    const html = await httpGet(`https://steamcommunity.com/sharedfiles/filedetails/?id=${workshopId}`);

    const titleMatch = html.match(/<div class="workshopItemTitle">([\s\S]*?)<\/div>/i);
    const title = titleMatch
      ? titleMatch[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      : `Mod #${workshopId}`;

    const previewMatch = html.match(/id="previewImage(?:Main)?"[^>]+src="([^">]+)"/i);
    const previewUrl = previewMatch ? previewMatch[1] : '';

    // Smart regex to extract Mod ID(s)
    // Matches patterns like:
    // Mod ID: MyModName
    // Mod ID = MyModName
    // ModID: MyModName
    // Mod-ID: MyModName
    // Mod ID: ModA, ModB, ModC
    const modIds = new Set();
    const lines = html.split(/\r?\n/);

    for (const line of lines) {
      const match = line.match(/Mod\s*(?:ID|-ID)?\s*[:=]\s*([a-zA-Z0-9_\-+.,;\s]+)/i);
      if (match) {
        // Strip any HTML tags that might follow
        let clean = match[1].replace(/<[^>]+>/g, '').trim();
        // Split by commas or semicolons if multiple IDs listed on one line
        const parts = clean.split(/[,;]/);
        for (let p of parts) {
          p = p.trim();
          // Filter out obvious noise or words like "None", "Required", etc.
          if (p && p.length >= 2 && !/^(required|recommended|optional|none|na|n\/a)$/i.test(p)) {
            // Take first continuous token without illegal spaces
            const token = p.split(/\s+/)[0];
            if (token && /^[a-zA-Z0-9_\-+]+$/.test(token)) {
              modIds.add(token);
            } else if (/^[a-zA-Z0-9_\-+]+$/.test(p)) {
              modIds.add(p);
            }
          }
        }
      }
    }

    const detectedModIds = Array.from(modIds);

    // If no explicit Mod ID was found in description, fallback to sanitized title
    if (detectedModIds.length === 0) {
      const sanitized = title.replace(/[^a-zA-Z0-9_]/g, '');
      if (sanitized) {
        detectedModIds.push(sanitized);
      } else {
        detectedModIds.push(`Mod_${workshopId}`);
      }
    }

    return {
      workshopId: workshopId.toString(),
      title,
      previewUrl,
      modIds: detectedModIds,
      primaryModId: detectedModIds[0] || ''
    };
  } catch (err) {
    return {
      workshopId: workshopId.toString(),
      title: `Mod #${workshopId}`,
      previewUrl: '',
      modIds: [`Mod_${workshopId}`],
      primaryModId: `Mod_${workshopId}`,
      error: err.message
    };
  }
}

/**
 * Fetch details for multiple mods with concurrency limit
 */
async function batchFetchModDetails(workshopIds, concurrency = 4) {
  const results = [];
  const queue = [...workshopIds];

  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      try {
        const details = await fetchModDetails(id);
        results.push(details);
      } catch (e) {
        results.push({
          workshopId: id,
          title: `Mod #${id}`,
          modIds: [`Mod_${id}`],
          primaryModId: `Mod_${id}`
        });
      }
    }
  }

  const workers = [];
  const numWorkers = Math.min(concurrency, workshopIds.length);
  for (let i = 0; i < numWorkers; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);

  // Preserve original order
  const orderMap = new Map();
  workshopIds.forEach((id, idx) => orderMap.set(id.toString(), idx));
  results.sort((a, b) => (orderMap.get(a.workshopId) || 0) - (orderMap.get(b.workshopId) || 0));

  return results;
}

/**
 * Parse arbitrary bulk text input (server.ini format, list of IDs, URLs, or mixed)
 */
function parseBulkText(text) {
  if (!text) return { workshopIds: [], modIds: [] };

  const workshopIds = new Set();
  const modIds = new Set();

  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // 1. Check for WorkshopItems=...
    if (/^WorkshopItems\s*=/i.test(trimmed)) {
      const val = trimmed.replace(/^WorkshopItems\s*=\s*/i, '');
      val.split(';').map(s => s.trim()).filter(Boolean).forEach(id => {
        const cleanId = extractId(id) || id;
        if (/^\d{6,}$/.test(cleanId)) workshopIds.add(cleanId);
      });
      continue;
    }

    // 2. Check for Mods=...
    if (/^Mods\s*=/i.test(trimmed)) {
      const val = trimmed.replace(/^Mods\s*=\s*/i, '');
      val.split(';').map(s => s.trim()).filter(Boolean).forEach(m => {
        if (m.length >= 2 && !/^(required|recommended|optional|none)$/i.test(m)) {
          modIds.add(m);
        }
      });
      continue;
    }

    // 3. Check for labeled Workshop ID: 123456
    const wsLabelMatch = trimmed.match(/Workshop\s*(?:ID|-ID)?\s*[:=]\s*(\d{6,})/i);
    if (wsLabelMatch) {
      workshopIds.add(wsLabelMatch[1]);
      continue;
    }

    // 4. Check for labeled Mod ID: MyModName
    const modLabelMatch = trimmed.match(/Mod\s*(?:ID|-ID)?\s*[:=]\s*([a-zA-Z0-9_\-+.,;\s]+)/i);
    if (modLabelMatch) {
      const parts = modLabelMatch[1].split(/[,;]/);
      for (let p of parts) {
        p = p.trim().split(/\s+/)[0];
        if (p && p.length >= 2 && !/^(required|recommended|optional|none|na|n\/a)$/i.test(p)) {
          modIds.add(p);
        }
      }
      continue;
    }

    // 5. Check for Steam Workshop URLs:
    // Matches https://steamcommunity.com/sharedfiles/filedetails/?id=2875848298
    // or https://steamcommunity.com/workshop/filedetails/?id=2875848298
    // or ?id=2875848298
    const urlMatches = [...trimmed.matchAll(/(?:id=|\/item\/)(\d{6,})/gi)].map(m => m[1]);
    if (urlMatches.length > 0) {
      urlMatches.forEach(id => workshopIds.add(id));
      continue;
    }

    // 6. Check if the line is purely a standalone Workshop ID number
    if (/^\d{6,}$/.test(trimmed)) {
      workshopIds.add(trimmed);
      continue;
    }

    // 7. Semicolon or comma delimited tokens
    const tokens = trimmed.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    for (const t of tokens) {
      if (/^\d{6,}$/.test(t)) {
        workshopIds.add(t);
      } else if (
        t.length >= 2 &&
        !/^(workshop|mod|id|item|items|mods|link|links|url|urls|http|https|steam|filedetails)$/i.test(t) &&
        /^[a-zA-Z0-9_\-+]+$/.test(t)
      ) {
        modIds.add(t);
      }
    }
  }

  return {
    workshopIds: Array.from(workshopIds),
    modIds: Array.from(modIds)
  };
}

const FRAMEWORK_DEPENDENCY_RULES = [
  {
    triggers: ['autotsar', 'tsartrailer', 'aquatsar', 'jaapwrangler', 'tuningatelier'],
    requiredMod: 'tsarslib',
    requiredWorkshopId: '2392709985',
    name: "Tsar's Common Library (tsarslib)"
  },
  {
    triggers: ['cyespushdoors', 'improvedhairmenu', 'improvedhairmenubuild42'],
    requiredMod: 'NeatUI_Framework',
    requiredWorkshopId: '3415470189',
    name: 'NeatUI Framework (NeatUI_Framework)'
  },
  {
    triggers: ['trueactionsdancing'],
    requiredMod: 'TrueActions',
    requiredWorkshopId: '2463184726',
    name: 'True Actions'
  },
  {
    triggers: ['arsenal26gunfighter'],
    requiredMod: 'Brita',
    requiredWorkshopId: '2200148440',
    name: "Brita's Weapon Pack / Arsenal[26] GunFighter"
  }
];

const KNOWN_FRAMEWORKS_ORDER = [
  'modtemplate', 'tsarslib', 'tsarcommonlibrary', 'trueactions', 'trueactionsdancing',
  'filibusterrhymesusedcars', 'filibuster', 'bettersort', 'neatui', 'neatui_framework',
  'itemtweakerapi', 'spawnmanager', 'k15', 'ki5', 'easyconfig_ch', 'starlitlibrary',
  'pzgate', 'equipmentui', 'automechanics', 'managecontainers'
];

async function validateModpack(workshopItems = [], mods = []) {
  const issues = [];
  const autoFixMods = [...mods];
  const autoFixWs = [...workshopItems];

  const wsDetails = await batchFetchModDetails(workshopItems.slice(0, 100), 5);

  for (const item of wsDetails) {
    const hasAnyActive = (item.modIds || []).some(mId => 
      mods.some(activeMod => activeMod.toLowerCase() === mId.toLowerCase())
    );
    if (!hasAnyActive && item.modIds && item.modIds.length > 0) {
      issues.push({
        id: `orphan_${item.workshopId}`,
        type: 'orphan_workshop_item',
        severity: 'warning',
        title: 'Downloaded but Inactive Mod',
        message: `Workshop item "${item.title}" (#${item.workshopId}) is in WorkshopItems, but mod "${item.modIds[0]}" is not enabled in Mods=.`,
        suggestedModId: item.modIds[0],
        workshopId: item.workshopId
      });
      if (!autoFixMods.includes(item.modIds[0])) {
        autoFixMods.push(item.modIds[0]);
      }
    }
  }

  for (const rule of FRAMEWORK_DEPENDENCY_RULES) {
    const triggeringMod = mods.find(m => 
      rule.triggers.some(t => m.toLowerCase().includes(t)) &&
      m.toLowerCase() !== rule.requiredMod.toLowerCase()
    );
    if (triggeringMod) {
      const hasRequirement = mods.some(m => m.toLowerCase().includes(rule.requiredMod.toLowerCase()));
      if (!hasRequirement) {
        issues.push({
          id: `missing_dep_${rule.requiredMod}`,
          type: 'missing_dependency',
          severity: 'error',
          title: 'Missing Core Dependency',
          message: `Active mod "${triggeringMod}" depends on "${rule.name}", which is not currently in Mods=.`,
          suggestedModId: rule.requiredMod,
          workshopId: rule.requiredWorkshopId
        });
        if (!autoFixMods.includes(rule.requiredMod)) {
          autoFixMods.unshift(rule.requiredMod);
        }
        if (rule.requiredWorkshopId && !autoFixWs.includes(rule.requiredWorkshopId)) {
          autoFixWs.push(rule.requiredWorkshopId);
        }
      }
    }
  }

  for (const fw of KNOWN_FRAMEWORKS_ORDER) {
    const fwIdx = mods.findIndex(m => m.toLowerCase().includes(fw));
    if (fwIdx > 5) {
      issues.push({
        id: `load_order_${fw}`,
        type: 'load_order_inversion',
        severity: 'info',
        title: 'Suboptimal Load Order Position',
        message: `Core library "${mods[fwIdx]}" is loaded at position #${fwIdx + 1}. Frameworks should ideally load at the beginning.`,
        suggestedModId: mods[fwIdx]
      });
    }
  }

  // Check for active mods that have missing Workshop IDs
  const allKnownWsModIds = new Set();
  for (const item of wsDetails) {
    (item.modIds || []).forEach(m => allKnownWsModIds.add(m.toLowerCase()));
  }

  for (const mod of mods) {
    const isDownloaded = allKnownWsModIds.has(mod.toLowerCase());
    if (!isDownloaded && wsDetails.length > 0) {
      const rule = FRAMEWORK_DEPENDENCY_RULES.find(r => r.requiredMod.toLowerCase() === mod.toLowerCase());
      if (rule && rule.requiredWorkshopId && !workshopItems.includes(rule.requiredWorkshopId)) {
        issues.push({
          id: `missing_ws_${mod}`,
          type: 'missing_workshop_item',
          severity: 'error',
          title: 'Missing Steam Workshop Item',
          message: `Active mod "${mod}" is enabled in Mods=, but its Workshop ID (#${rule.requiredWorkshopId}) is missing from WorkshopItems=.`,
          suggestedModId: mod,
          workshopId: rule.requiredWorkshopId
        });
        if (!autoFixWs.includes(rule.requiredWorkshopId)) {
          autoFixWs.push(rule.requiredWorkshopId);
        }
      }
    }
  }

  const frameworks = [];
  const others = [];
  autoFixMods.forEach(m => {
    if (KNOWN_FRAMEWORKS_ORDER.some(fw => m.toLowerCase().includes(fw))) {
      frameworks.push(m);
    } else {
      others.push(m);
    }
  });

  frameworks.sort((a, b) => {
    const idxA = KNOWN_FRAMEWORKS_ORDER.findIndex(fw => a.toLowerCase().includes(fw));
    const idxB = KNOWN_FRAMEWORKS_ORDER.findIndex(fw => b.toLowerCase().includes(fw));
    return (idxA >= 0 ? idxA : 999) - (idxB >= 0 ? idxB : 999);
  });

  const optimizedMods = [...new Set([...frameworks, ...others])];
  const optimizedWs = [...new Set(autoFixWs)];

  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    hasWarnings: issues.length > 0,
    issues,
    stats: {
      totalWorkshopItems: workshopItems.length,
      totalMods: mods.length,
      issuesCount: issues.length
    },
    autoFix: {
      workshopItems: optimizedWs,
      mods: optimizedMods
    }
  };
}

module.exports = {
  fetchCollection,
  fetchModDetails,
  batchFetchModDetails,
  parseBulkText,
  validateModpack,
  extractId
};
