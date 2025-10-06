const JSON_MIME = 'application/json';
const TEXT_MIME = 'text/plain';

const empty = Object.freeze([]);

export const readTreeIdsFromDataTransfer = (dataTransfer) => {
  if (!dataTransfer) {
    return empty;
  }

  try {
    const raw = dataTransfer.getData(JSON_MIME);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.treeIds)) {
        return parsed.treeIds.filter(Boolean);
      }
    }
  } catch (error) {
    console.error('Failed to parse drag payload (json)', error);
  }

  try {
    const fallback = dataTransfer.getData(TEXT_MIME);
    if (fallback) {
      return fallback
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
    }
  } catch (error) {
    console.error('Failed to parse drag payload (text)', error);
  }

  return empty;
};

export const writeTreeIdsToDataTransfer = (dataTransfer, treeIds) => {
  if (!dataTransfer || !Array.isArray(treeIds) || treeIds.length === 0) {
    return;
  }

  const payload = treeIds.filter(Boolean);
  if (payload.length === 0) {
    return;
  }

  try {
    dataTransfer.setData(JSON_MIME, JSON.stringify({ treeIds: payload }));
  } catch (error) {
    console.error('Failed to serialize drag payload (json)', error);
  }

  try {
    dataTransfer.setData(TEXT_MIME, payload.join(','));
  } catch (error) {
    console.error('Failed to serialize drag payload (text)', error);
  }
};

export default {
  readTreeIdsFromDataTransfer,
  writeTreeIdsToDataTransfer,
};
