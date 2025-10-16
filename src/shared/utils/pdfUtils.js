let pdfjsLibPromise = null;

const resolvePdfjsLib = async () => {
  if (pdfjsLibPromise) {
    return pdfjsLibPromise;
  }

  pdfjsLibPromise = Promise.all([
    import('pdfjs-dist/legacy/build/pdf'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
  ])
    .then(([pdfjsLib, workerModule]) => {
      try {
        if (pdfjsLib?.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
          const workerSrc = workerModule?.default || workerModule;
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
        }
      } catch (error) {
        // 워커 설정 실패는 텍스트 추출에는 치명적이지 않으므로 무시
        console.warn('[pdfUtils] Failed to configure pdf.js worker', error);
      }
      return pdfjsLib;
    })
    .catch((error) => {
      console.error('[pdfUtils] Failed to load pdf.js library or worker', error);
      throw error;
    });

  return pdfjsLibPromise;
};

const extractPageText = async (doc, pageNumber) => {
  const page = await doc.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const items = Array.isArray(textContent.items) ? textContent.items : [];
  const text = items
    .map((item) => item?.str || '')
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
};

export const extractTextFromPdf = async (arrayBuffer) => {
  const pdfjsLib = await resolvePdfjsLib();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });

  let doc = null;
  try {
    doc = await loadingTask.promise;
    const totalPages = doc.numPages || 0;

    if (totalPages === 0) {
      return { textContent: '', pageCount: 0 };
    }

    const pageTexts = [];
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      try {
        const pageText = await extractPageText(doc, pageNumber);
        if (pageText) {
          pageTexts.push(pageText);
        }
      } catch (pageError) {
        console.warn('[pdfUtils] Failed to extract text from page', pageNumber, pageError);
      }
    }

    return {
      textContent: pageTexts.join('\n\n').trim(),
      pageCount: totalPages,
    };
  } finally {
    try {
      await loadingTask.destroy();
    } catch (cleanupError) {
      console.warn('[pdfUtils] Failed to clean up pdf loading task', cleanupError);
    }
    if (doc && typeof doc.destroy === 'function') {
      doc.destroy();
    }
  }
};
