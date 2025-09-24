const normalizeEndpoint = (endpoint) => {
  if (endpoint == null) return '';
  if (typeof endpoint === 'string') return endpoint;
  if (typeof endpoint === 'object') {
    if ('id' in endpoint && endpoint.id != null) {
      return String(endpoint.id);
    }
    if ('name' in endpoint && endpoint.name != null) {
      return String(endpoint.name);
    }
    if ('value' in endpoint && endpoint.value != null) {
      return String(endpoint.value);
    }
    return JSON.stringify(endpoint);
  }
  return String(endpoint);
};

export const buildLinkKey = (link) => {
  const source = normalizeEndpoint(link?.source);
  const target = normalizeEndpoint(link?.target);
  return `${source}->${target}`;
};

export const markNewLinks = (previousKeys = new Set(), incomingLinks = []) => {
  const baseline = previousKeys instanceof Set ? previousKeys : new Set(previousKeys);
  const nextKeys = new Set();

  const annotatedLinks = incomingLinks.map((rawLink) => {
    const key = buildLinkKey(rawLink);
    const isNew = !baseline.has(key);
    nextKeys.add(key);

    return {
      source: normalizeEndpoint(rawLink?.source),
      target: normalizeEndpoint(rawLink?.target),
      value: rawLink?.value ?? 1,
      key,
      isNew,
    };
  });

  return { annotatedLinks, nextKeys };
};
